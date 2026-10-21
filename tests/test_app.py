"""Fast, network-free regression checks for SlothDesk's safety and workflow."""
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


class SlothDeskTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.old = app.DATA, app.INBOX, app.ORGANIZED, app.HISTORY
        app.DATA = self.root
        app.INBOX = self.root / 'inbox'
        app.ORGANIZED = self.root / 'organized'
        app.HISTORY = self.root / 'history.json'
        app.ensure_dirs()

    def tearDown(self):
        app.DATA, app.INBOX, app.ORGANIZED, app.HISTORY = self.old
        self.tmp.cleanup()

    def test_demo_is_idempotent(self):
        self.assertEqual(len(app.seed_demo()), 6)
        self.assertEqual(len(app.seed_demo()), 0)
        self.assertEqual(len(app.list_inbox()), 6)
        self.assertEqual(len(app.category_counts()), 7)

    def test_untrusted_path_rejected(self):
        for path in ['../outside.txt', '/tmp/other.txt', '..\\other.txt', '.secret.txt', 'sample.pdf']:
            with self.subTest(path=path):
                self.assertFalse(app.accepted_file(path))
        (app.INBOX / 'safe.txt').write_text('hi')
        with self.assertRaises(ValueError):
            app.checked_source('../safe.txt')

    def test_model_response_normalizes_filename_and_category(self):
        (app.INBOX / 'note.txt').write_text('hello')
        with patch.object(app, 'local_ai', return_value={
            'category': 'Reading', 'suggested_stem': 'Careful! 2026 > book notes',
            'summary': 'Notes for tomorrow.', 'reason': 'Reading list'}):
            result = app.analyze_one('note.txt')
        self.assertEqual(result['category'], 'Reading')
        self.assertEqual(result['suggested_name'], 'Careful-2026-book-notes.txt')
        self.assertEqual(result['summary'], 'Notes for tomorrow.')

    def test_invalid_model_category_does_not_create_directories(self):
        (app.INBOX / 'note.md').write_text('Hello')
        with patch.object(app, 'local_ai', return_value={'category':'../../Secrets','suggested_stem':'../unsafe'}):
            result = app.analyze_one('note.md')
        self.assertEqual(result['category'], 'Other')
        self.assertEqual(result['suggested_name'], 'unsafe.md')

    def test_apply_moves_and_undo_restores(self):
        (app.INBOX / 'draft.txt').write_text('Finance draft')
        result = app.apply_plan([{'name':'draft.txt','category':'Finance','suggested_name':'budget-2026.txt'}])
        self.assertEqual(len(result['moved']), 1)
        self.assertTrue((app.ORGANIZED / 'Finance' / 'budget-2026.txt').exists())
        self.assertFalse((app.INBOX / 'draft.txt').exists())
        self.assertEqual(app.category_counts()['Finance'], 1)
        result2 = app.undo_last()
        self.assertEqual(result2['restored'], ['draft.txt'])
        self.assertTrue((app.INBOX / 'draft.txt').exists())
        self.assertEqual(app.category_counts()['Finance'], 0)
        with self.assertRaises(ValueError):
            app.undo_last()

    def test_existing_destination_never_overwritten(self):
        (app.INBOX / 'one.txt').write_text('first')
        (app.INBOX / 'two.txt').write_text('second')
        plan = [{'name':'one.txt','category':'Study','suggested_name':'notes.txt'},
                {'name':'two.txt','category':'Study','suggested_name':'notes.txt'}]
        result = app.apply_plan(plan)
        self.assertEqual(len(result['moved']), 2)
        self.assertEqual((app.ORGANIZED / 'Study' / 'notes.txt').read_text(), 'first')
        self.assertEqual((app.ORGANIZED / 'Study' / 'notes-2.txt').read_text(), 'second')

    def test_undo_does_not_overwrite_new_file(self):
        (app.INBOX / 'memo.md').write_text('Old')
        app.apply_plan([{'name':'memo.md','category':'Study','suggested_name':'study-memo.md'}])
        (app.INBOX / 'memo.md').write_text('New')
        result = app.undo_last()
        self.assertEqual(result['restored'], [])
        self.assertEqual(len(result['errors']), 1)
        self.assertEqual((app.INBOX / 'memo.md').read_text(), 'New')

    def test_symlink_inbox_file_rejected(self):
        outside = self.root / 'outside.txt'
        outside.write_text('Outside')
        (app.INBOX / 'unsafe.txt').symlink_to(outside)
        with self.assertRaises(ValueError):
            app.checked_source('unsafe.txt')
        self.assertEqual(app.list_inbox(), [])

    def test_bulk_duplicate_rejected(self):
        (app.INBOX / 'a.txt').write_text('a')
        with self.assertRaises(ValueError):
            app.apply_plan([{'name':'a.txt','category':'Study'}, {'name':'a.txt','category':'Code'}])

    def test_no_model_heuristic_fallback(self):
        (app.INBOX / 'finance.txt').write_text('Monthly costs')
        with patch.object(app, 'local_ai', side_effect=ValueError('No local inference available')):
            with self.assertRaisesRegex(ValueError, 'No local inference available'):
                app.analyze_one('finance.txt')

    def test_ollama_json_transport_with_local_stub(self):
        from http.server import BaseHTTPRequestHandler
        class LocalStub(BaseHTTPRequestHandler):
            def do_POST(self):
                self.server.received_path = self.path
                length = int(self.headers['Content-Length'])
                payload = json.loads(self.rfile.read(length))
                self.server.received_model = payload['model']
                response = json.dumps({'message': {'content': json.dumps({
                    'category': 'Study', 'suggested_stem': 'tcp-lecture',
                    'summary': 'Class notes on TCP.', 'reason': 'Lecture material'})}}).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(response)))
                self.end_headers()
                self.wfile.write(response)
            def log_message(self, *_): pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), LocalStub)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            (app.INBOX / 'notes.txt').write_text('Lecture notes on TCP')
            with patch.object(app, 'OLLAMA', f'http://127.0.0.1:{server.server_port}'):
                result = app.analyze_one('notes.txt', 'qwen2.5:1.5b')
            self.assertEqual(result['category'], 'Study')
            self.assertEqual(result['suggested_name'], 'tcp-lecture.txt')
            self.assertEqual(server.received_path, '/api/chat')
            self.assertEqual(server.received_model, 'qwen2.5:1.5b')
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_http_local_endpoints(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        try:
            with urlopen(base+'/api/files') as r:
                self.assertEqual(json.load(r)['files'], [])
            req=Request(base+'/api/demo',data=b'{}',method='POST',headers={'Content-Type':'application/json'})
            with urlopen(req) as r:
                self.assertEqual(len(json.load(r)['created']), 6)
            with urlopen(base+'/api/files') as r:
                self.assertEqual(len(json.load(r)['files']), 6)
            req=Request(base+'/api/apply',data=json.dumps({'items':[{'name':'../evil.txt','category':'Code'}]}).encode(),
                        method='POST',headers={'Content-Type':'application/json'})
            with urlopen(req) as r:
                self.assertEqual(len(json.load(r)['errors']), 1)
            with urlopen(base+'/styles.css') as r:
                self.assertIn(b'.hero', r.read())
        finally:
            server.shutdown();server.server_close();thread.join(timeout=2)


if __name__ == '__main__':
    unittest.main()
