"""Fast, network-free regression checks for SlothDesk's safety and workflow."""
import errno
import json
import os
import shutil
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError
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

    def test_concurrent_apply_same_file(self):
        """Simultaneous apply requests targeting the same source file must process it exactly once."""
        (app.INBOX / 'shared.txt').write_text('Shared content')
        plan = [{'name': 'shared.txt', 'category': 'Study', 'suggested_name': 'shared.txt'}]
        results = []
        errors = []

        def worker():
            try:
                res = app.apply_plan(plan)
                results.append(res)
            except Exception as e:
                errors.append(e)

        t1 = threading.Thread(target=worker)
        t2 = threading.Thread(target=worker)
        t1.start(); t2.start()
        t1.join(); t2.join()

        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 2)
        total_moved = sum(len(r['moved']) for r in results)
        total_errs = sum(len(r['errors']) for r in results)
        self.assertEqual(total_moved, 1)
        self.assertEqual(total_errs, 1)
        self.assertFalse((app.INBOX / 'shared.txt').exists())
        self.assertTrue((app.ORGANIZED / 'Study' / 'shared.txt').exists())
        self.assertEqual((app.ORGANIZED / 'Study' / 'shared.txt').read_text(), 'Shared content')

    def test_concurrent_history_updates(self):
        """Concurrent requests creating batches must not corrupt history or drop updates."""
        file_count = 8
        for i in range(file_count):
            (app.INBOX / f'file_{i}.txt').write_text(f'Content {i}')

        def worker(idx):
            app.apply_plan([{'name': f'file_{idx}.txt', 'category': 'Code', 'suggested_name': f'file_{idx}.txt'}])

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(file_count)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        history = app.json_read_history()
        self.assertEqual(len(history), file_count)
        all_moved = {m['source'] for b in history for m in b['moves']}
        self.assertEqual(all_moved, {f'file_{i}.txt' for i in range(file_count)})

    def test_apply_and_undo_overlap(self):
        """Simultaneous apply and undo operations serialize cleanly without corruption or deadlock."""
        (app.INBOX / 'batch1.txt').write_text('Batch 1')
        app.apply_plan([{'name': 'batch1.txt', 'category': 'Reading', 'suggested_name': 'batch1.txt'}])

        (app.INBOX / 'batch2.txt').write_text('Batch 2')

        results = {}
        def do_undo():
            results['undo'] = app.undo_last()

        def do_apply():
            results['apply'] = app.apply_plan([{'name': 'batch2.txt', 'category': 'Code', 'suggested_name': 'batch2.txt'}])

        t_undo = threading.Thread(target=do_undo)
        t_apply = threading.Thread(target=do_apply)
        t_undo.start(); t_apply.start()
        t_undo.join(); t_apply.join()

        self.assertIn('undo', results)
        self.assertIn('apply', results)
        self.assertTrue((app.ORGANIZED / 'Code' / 'batch2.txt').exists())
        self.assertTrue((app.INBOX / 'batch1.txt').exists())
        history = app.json_read_history()
        self.assertTrue(all(isinstance(b, dict) for b in history))

    def test_concurrent_destination_collision_resolution(self):
        """Concurrent requests suggesting the same destination filename must avoid overwriting."""
        (app.INBOX / 'source_a.txt').write_text('Content A')
        (app.INBOX / 'source_b.txt').write_text('Content B')

        results = []
        def worker(name):
            res = app.apply_plan([{'name': name, 'category': 'Projects', 'suggested_name': 'project-doc.txt'}])
            results.append(res)

        t1 = threading.Thread(target=worker, args=('source_a.txt',))
        t2 = threading.Thread(target=worker, args=('source_b.txt',))
        t1.start(); t2.start()
        t1.join(); t2.join()

        self.assertEqual(len(results), 2)
        total_moved = sum(len(r['moved']) for r in results)
        self.assertEqual(total_moved, 2)

        doc1 = app.ORGANIZED / 'Projects' / 'project-doc.txt'
        doc2 = app.ORGANIZED / 'Projects' / 'project-doc-2.txt'
        self.assertTrue(doc1.exists())
        self.assertTrue(doc2.exists())
        contents = {doc1.read_text(), doc2.read_text()}
        self.assertEqual(contents, {'Content A', 'Content B'})

    def test_cross_filesystem_transfer_simulation(self):
        """When atomic os.link fails with EXDEV, safe_move_file falls back to staging and succeeds."""
        (app.INBOX / 'cross_device.txt').write_text('Data across devices')

        original_link = os.link
        link_calls = []

        def mock_link(src, dst):
            link_calls.append((str(src), str(dst)))
            if 'cross_device.txt' in str(src) and '.tmp-' not in str(src):
                err = OSError("Invalid cross-device link")
                err.errno = errno.EXDEV
                raise err
            return original_link(src, dst)

        with patch('os.link', side_effect=mock_link):
            result = app.apply_plan([{'name': 'cross_device.txt', 'category': 'Study', 'suggested_name': 'cross_device.txt'}])

        self.assertEqual(len(result['moved']), 1)
        self.assertEqual(len(result['errors']), 0)
        dest = app.ORGANIZED / 'Study' / 'cross_device.txt'
        self.assertTrue(dest.exists())
        self.assertEqual(dest.read_text(), 'Data across devices')
        self.assertFalse((app.INBOX / 'cross_device.txt').exists())
        self.assertTrue(any('.tmp-cross_device' in str(call[0]) for call in link_calls))

    def test_failure_during_cross_device_copy_cleans_up_and_preserves_source(self):
        """If shutil.copy2 fails during cross-filesystem move, staging file is cleaned up and source preserved."""
        (app.INBOX / 'copy_fail.txt').write_text('Valuable original')

        def mock_link(src, dst):
            if '.tmp-' not in str(src):
                err = OSError("Invalid cross-device link")
                err.errno = errno.EXDEV
                raise err
            return os.link(src, dst)

        def mock_copy2(src, dst):
            Path(dst).write_text('Incomplete data...')
            raise IOError("No space left on device")

        with patch('os.link', side_effect=mock_link), patch('shutil.copy2', side_effect=mock_copy2):
            result = app.apply_plan([{'name': 'copy_fail.txt', 'category': 'Finance', 'suggested_name': 'report.txt'}])

        self.assertEqual(len(result['moved']), 0)
        self.assertEqual(len(result['errors']), 1)
        self.assertIn("No space left on device", result['errors'][0]['message'])

        self.assertTrue((app.INBOX / 'copy_fail.txt').exists())
        self.assertEqual((app.INBOX / 'copy_fail.txt').read_text(), 'Valuable original')
        self.assertFalse((app.ORGANIZED / 'Finance' / 'report.txt').exists())

        staging_files = list((app.ORGANIZED / 'Finance').glob('.tmp-*'))
        self.assertEqual(staging_files, [])
        self.assertEqual(app.json_read_history(), [])

    def test_failure_during_source_removal_triggers_rollback(self):
        """If removing source fails after copying, destination is rolled back and error reported."""
        (app.INBOX / 'unlink_fail.txt').write_text('Source cannot be unlinked')

        original_link = os.link
        def mock_link(src, dst):
            if '.tmp-' not in str(src):
                err = OSError("Invalid cross-device link")
                err.errno = errno.EXDEV
                raise err
            return original_link(src, dst)

        original_unlink = os.unlink
        def mock_unlink(path, *args, **kwargs):
            if 'unlink_fail.txt' in str(path):
                raise PermissionError("Permission denied: cannot delete source")
            return original_unlink(path, *args, **kwargs)

        with patch('os.link', side_effect=mock_link), patch('os.unlink', side_effect=mock_unlink):
            result = app.apply_plan([{'name': 'unlink_fail.txt', 'category': 'Personal', 'suggested_name': 'doc.txt'}])

        self.assertEqual(len(result['moved']), 0)
        self.assertEqual(len(result['errors']), 1)
        self.assertIn("Permission denied", result['errors'][0]['message'])

        self.assertTrue((app.INBOX / 'unlink_fail.txt').exists())
        self.assertFalse((app.ORGANIZED / 'Personal' / 'doc.txt').exists())
        self.assertEqual(app.json_read_history(), [])

    def test_toctou_same_filesystem_destination_created_after_check(self):
        """If destination appears concurrently on same filesystem, atomic link refuses to overwrite."""
        (app.INBOX / 'toctou_src.txt').write_text('Source content')
        target = app.ORGANIZED / 'Study' / 'toctou_dst.txt'
        (app.ORGANIZED / 'Study').mkdir(parents=True, exist_ok=True)

        real_link = os.link
        def race_link(s, d):
            # Simulate another process creating target immediately before link
            target.write_text('Concurrent file created by another process')
            return real_link(s, d)

        with patch('os.link', side_effect=race_link):
            with self.assertRaises(FileExistsError):
                app.safe_move_file(app.INBOX / 'toctou_src.txt', target)

        self.assertEqual(target.read_text(), 'Concurrent file created by another process')
        self.assertTrue((app.INBOX / 'toctou_src.txt').exists())
        self.assertEqual((app.INBOX / 'toctou_src.txt').read_text(), 'Source content')

    def test_toctou_cross_filesystem_destination_created_during_staging(self):
        """If destination appears concurrently during cross-filesystem staging, commit refuses overwrite."""
        (app.INBOX / 'staged_src.txt').write_text('Cross-device source')
        target = app.ORGANIZED / 'Code' / 'staged_dst.txt'
        (app.ORGANIZED / 'Code').mkdir(parents=True, exist_ok=True)

        real_link = os.link
        def mock_link(s, d):
            if 'staged_src.txt' in str(s):
                err = OSError("Invalid cross-device link")
                err.errno = errno.EXDEV
                raise err
            return real_link(s, d)

        real_copy2 = shutil.copy2
        def mock_copy2(s, d):
            res = real_copy2(s, d)
            target.write_text('Concurrent external file')
            return res

        with patch('os.link', side_effect=mock_link), patch('shutil.copy2', side_effect=mock_copy2):
            with self.assertRaises(FileExistsError):
                app.safe_move_file(app.INBOX / 'staged_src.txt', target)

        self.assertEqual(target.read_text(), 'Concurrent external file')
        self.assertTrue((app.INBOX / 'staged_src.txt').exists())
        self.assertEqual((app.INBOX / 'staged_src.txt').read_text(), 'Cross-device source')
        staging_files = list((app.ORGANIZED / 'Code').glob('.tmp-*'))
        self.assertEqual(staging_files, [])




    def test_history_consistency_after_failed_batch(self):
        """Batches where all items fail record no history; partial failures record only succeeded items."""
        result = app.apply_plan([{'name': 'nonexistent.txt', 'category': 'Other'}])
        self.assertEqual(len(result['moved']), 0)
        self.assertEqual(len(result['errors']), 1)
        self.assertEqual(app.json_read_history(), [])

        (app.INBOX / 'good.txt').write_text('Good file')
        result2 = app.apply_plan([
            {'name': 'good.txt', 'category': 'Study', 'suggested_name': 'good.txt'},
            {'name': 'bad.txt', 'category': 'Study', 'suggested_name': 'bad.txt'}
        ])
        self.assertEqual(len(result2['moved']), 1)
        self.assertEqual(len(result2['errors']), 1)

        history = app.json_read_history()
        self.assertEqual(len(history), 1)
        self.assertEqual(len(history[0]['moves']), 1)
        self.assertEqual(history[0]['moves'][0]['source'], 'good.txt')
        self.assertFalse(history[0]['undone'])

    def test_undo_safety_after_partial_conflict(self):
        """Undo skips items that encounter conflicts, restores clean items, and preserves remaining undone state."""
        (app.INBOX / 'f1.txt').write_text('Content 1')
        (app.INBOX / 'f2.txt').write_text('Content 2')
        app.apply_plan([
            {'name': 'f1.txt', 'category': 'Code', 'suggested_name': 'f1.txt'},
            {'name': 'f2.txt', 'category': 'Code', 'suggested_name': 'f2.txt'}
        ])

        (app.INBOX / 'f1.txt').write_text('Conflict in inbox')

        undo_res = app.undo_last()
        self.assertEqual(undo_res['restored'], ['f2.txt'])
        self.assertEqual(len(undo_res['errors']), 1)
        self.assertEqual(undo_res['errors'][0]['name'], 'f1.txt')
        self.assertIn("already exists", undo_res['errors'][0]['message'])

        self.assertEqual((app.INBOX / 'f1.txt').read_text(), 'Conflict in inbox')
        self.assertTrue((app.ORGANIZED / 'Code' / 'f1.txt').exists())
        self.assertTrue((app.INBOX / 'f2.txt').exists())

        history = app.json_read_history()
        self.assertFalse(history[0]['undone'])
        self.assertTrue(history[0]['moves'][1]['undone'])
        self.assertFalse(history[0]['moves'][0]['undone'])

        (app.INBOX / 'f1.txt').unlink()
        undo_res2 = app.undo_last()
        self.assertEqual(undo_res2['restored'], ['f1.txt'])
        self.assertEqual(len(undo_res2['errors']), 0)
        self.assertEqual((app.INBOX / 'f1.txt').read_text(), 'Content 1')
        self.assertTrue(app.json_read_history()[0]['undone'])

    def test_preservation_and_prevention_of_unintended_overwrites(self):
        """Existing files in destination categories or inbox are never overwritten during apply or undo."""
        (app.ORGANIZED / 'Finance').mkdir(parents=True, exist_ok=True)
        (app.ORGANIZED / 'Finance' / 'tax.txt').write_text('Important Tax Records 2025')

        (app.INBOX / 'receipt.txt').write_text('Receipt 2026')
        result = app.apply_plan([{'name': 'receipt.txt', 'category': 'Finance', 'suggested_name': 'tax.txt'}])

        self.assertEqual((app.ORGANIZED / 'Finance' / 'tax.txt').read_text(), 'Important Tax Records 2025')
        self.assertTrue((app.ORGANIZED / 'Finance' / 'tax-2.txt').exists())
        self.assertEqual((app.ORGANIZED / 'Finance' / 'tax-2.txt').read_text(), 'Receipt 2026')

        with self.assertRaises(FileExistsError):
            app.safe_move_file(app.ORGANIZED / 'Finance' / 'tax-2.txt', app.ORGANIZED / 'Finance' / 'tax.txt')

    def test_get_uri_length_limit(self):
        """GET request with URI exceeding 1024 characters must return HTTP 414."""
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            long_path = '/api/files?' + ('x' * 1100)
            req = Request(base + long_path)
            with self.assertRaises(HTTPError) as ctx:
                urlopen(req)
            self.assertEqual(ctx.exception.code, 414)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_selective_analyze_validation(self):
        """Selective analysis endpoint validates batch size, item types, and uniqueness."""
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            # 1. Empty files list
            req = Request(base + '/api/analyze', data=json.dumps({'files': []}).encode(),
                          headers={'Content-Type': 'application/json'}, method='POST')
            with self.assertRaises(HTTPError) as ctx:
                urlopen(req)
            self.assertEqual(ctx.exception.code, 400)

            # 2. Duplicate filenames in batch
            req = Request(base + '/api/analyze', data=json.dumps({'files': ['doc1.txt', 'doc1.txt']}).encode(),
                          headers={'Content-Type': 'application/json'}, method='POST')
            with self.assertRaises(HTTPError) as ctx:
                urlopen(req)
            self.assertEqual(ctx.exception.code, 400)
            err_body = json.loads(ctx.exception.read().decode())
            self.assertIn("File names must be unique strings", err_body["error"])

            # 3. Non-string items
            req = Request(base + '/api/analyze', data=json.dumps({'files': [123]}).encode(),
                          headers={'Content-Type': 'application/json'}, method='POST')
            with self.assertRaises(HTTPError) as ctx:
                urlopen(req)
            self.assertEqual(ctx.exception.code, 400)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_analyze_single_file_success(self):
        """Single file analysis returns clean proposal with 200 OK."""
        (app.INBOX / 'readme.txt').write_text('Project documentation and setup notes.')
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            with patch.object(app, 'installed_models', return_value={'reachable': True, 'models': ['qwen2.5:1.5b']}), \
                 patch.object(app, 'local_ai', return_value={
                     'category': 'Projects', 'suggested_stem': 'readme-guide',
                     'summary': 'Setup instructions', 'reason': 'Project docs'}):
                req = Request(base + '/api/analyze', data=json.dumps({'files': ['readme.txt']}).encode(),
                              headers={'Content-Type': 'application/json'}, method='POST')
                with urlopen(req) as resp:
                    data = json.loads(resp.read().decode())
                self.assertEqual(len(data['suggestions']), 1)
                self.assertEqual(len(data['errors']), 0)
                self.assertEqual(data['suggestions'][0]['name'], 'readme.txt')
                self.assertEqual(data['suggestions'][0]['category'], 'Projects')
                self.assertEqual(data['suggestions'][0]['suggested_name'], 'readme-guide.txt')
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_analyze_multiple_files_success(self):
        """Multi-file batch processes each file and returns all proposals."""
        (app.INBOX / 'doc1.md').write_text('First doc')
        (app.INBOX / 'doc2.py').write_text('Second script')
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            with patch.object(app, 'installed_models', return_value={'reachable': True, 'models': ['qwen2.5:1.5b']}), \
                 patch.object(app, 'local_ai', side_effect=[
                     {'category': 'Reading', 'suggested_stem': 'first-doc', 'summary': 'Doc 1', 'reason': 'Notes'},
                     {'category': 'Code', 'suggested_stem': 'second-script', 'summary': 'Script 2', 'reason': 'Python'}]):
                req = Request(base + '/api/analyze', data=json.dumps({'files': ['doc1.md', 'doc2.py']}).encode(),
                              headers={'Content-Type': 'application/json'}, method='POST')
                with urlopen(req) as resp:
                    data = json.loads(resp.read().decode())
                self.assertEqual(len(data['suggestions']), 2)
                self.assertEqual(len(data['errors']), 0)
                self.assertEqual(data['suggestions'][0]['suggested_name'], 'first-doc.md')
                self.assertEqual(data['suggestions'][1]['suggested_name'], 'second-script.py')
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_analyze_connection_failure(self):
        """When Ollama is unreachable, returns clear recovery message without crashing."""
        (app.INBOX / 'test.txt').write_text('content')
        with patch('app.urlopen', side_effect=URLError(ConnectionRefusedError(61, 'Connection refused'))):
            with self.assertRaises(ValueError) as ctx:
                app.local_ai('prompt')
            self.assertIn("Local Ollama server is unreachable on localhost:11434. Run 'ollama serve'.", str(ctx.exception))

    def test_analyze_timeout(self):
        """When Ollama times out, returns distinct timeout recovery message."""
        (app.INBOX / 'test.txt').write_text('content')
        with patch('app.urlopen', side_effect=TimeoutError('timed out')):
            with self.assertRaises(ValueError) as ctx:
                app.local_ai('prompt')
            self.assertIn("Ollama request timed out after 90 seconds", str(ctx.exception))

    def test_analyze_invalid_json_response(self):
        """When model outputs malformed non-JSON, returns retry advice."""
        (app.INBOX / 'test.txt').write_text('content')
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({'message': {'content': 'Sorry, I cannot format as JSON'}}).encode()
        mock_resp.__enter__.return_value = mock_resp
        with patch('app.urlopen', return_value=mock_resp):
            with self.assertRaises(ValueError) as ctx:
                app.local_ai('prompt')
            self.assertIn("Model did not return valid JSON. Retry this file.", str(ctx.exception))

    def test_analyze_partial_failure(self):
        """Partial failure in batch preserves successful proposals and isolates errors."""
        (app.INBOX / 'good.txt').write_text('valid content')
        (app.INBOX / 'corrupt.txt').write_text('corrupt content')
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            def fake_analyze(name, model=app.DEFAULT_MODEL):
                if name == 'corrupt.txt':
                    raise ValueError('Corrupted document format')
                return {'name': name, 'category': 'Study', 'suggested_name': 'good-doc.txt',
                        'summary': 'Good', 'reason': 'Valid'}

            with patch.object(app, 'installed_models', return_value={'reachable': True, 'models': ['qwen2.5:1.5b']}), \
                 patch.object(app, 'analyze_one', side_effect=fake_analyze):
                req = Request(base + '/api/analyze', data=json.dumps({'files': ['good.txt', 'corrupt.txt']}).encode(),
                              headers={'Content-Type': 'application/json'}, method='POST')
                with urlopen(req) as resp:
                    data = json.loads(resp.read().decode())
                self.assertEqual(len(data['suggestions']), 1)
                self.assertEqual(data['suggestions'][0]['name'], 'good.txt')
                self.assertEqual(len(data['errors']), 1)
                self.assertEqual(data['errors'][0]['name'], 'corrupt.txt')
                self.assertIn('Corrupted document format', data['errors'][0]['message'])
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_analyze_model_selection_routed(self):
        """Selected custom model name is routed to Ollama payload."""
        (app.INBOX / 'sample.md').write_text('# Title')
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            with patch.object(app, 'installed_models', return_value={'reachable': True, 'models': ['custom-qwen:7b']}), \
                 patch.object(app, 'analyze_one', return_value={
                     'name': 'sample.md', 'category': 'Reading', 'suggested_name': 'sample.md',
                     'summary': '', 'reason': ''}) as mock_analyze:
                req = Request(base + '/api/analyze',
                              data=json.dumps({'files': ['sample.md'], 'model': 'custom-qwen:7b'}).encode(),
                              headers={'Content-Type': 'application/json'}, method='POST')
                with urlopen(req) as resp:
                    self.assertEqual(resp.status, 200)
                mock_analyze.assert_called_once_with('sample.md', 'custom-qwen:7b')
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_apply_revalidates_and_handles_missing_source(self):
        """Approval step revalidates files and safely reports if source file disappeared."""
        (app.INBOX / 'transient.txt').write_text('content')
        (app.INBOX / 'transient.txt').unlink()

        plan = [{'name': 'transient.txt', 'category': 'Other', 'suggested_name': 'transient.txt'}]
        result = app.apply_plan(plan)
        self.assertEqual(len(result['moved']), 0)
        self.assertEqual(len(result['errors']), 1)
        self.assertEqual(result['errors'][0]['name'], 'transient.txt')
        self.assertIn('missing', result['errors'][0]['message'].lower())

    def test_undo_handles_missing_destination(self):
        """Undo step skips missing destination items, records error, and preserves consistency."""
        (app.INBOX / 'orig.txt').write_text('Original')
        app.apply_plan([{'name': 'orig.txt', 'category': 'Reading', 'suggested_name': 'orig.txt'}])

        (app.ORGANIZED / 'Reading' / 'orig.txt').unlink()

        res = app.undo_last()
        self.assertEqual(len(res['restored']), 0)
        self.assertEqual(len(res['errors']), 1)
        self.assertEqual(res['errors'][0]['name'], 'orig.txt')

    def test_rollback_preserves_externally_replaced_destination(self):
        """If destination was replaced by an external process, rollback must NOT delete it."""
        src = app.INBOX / 'keep_src.txt'
        src.write_text('Original source content')
        dst = app.ORGANIZED / 'Code' / 'keep_src.txt'
        (app.ORGANIZED / 'Code').mkdir(parents=True, exist_ok=True)

        original_unlink = os.unlink
        def race_unlink(path, *args, **kwargs):
            if 'keep_src.txt' in str(path) and str(path) == str(src):
                # Simulate external process replacing destination with its own file
                original_unlink(dst)
                dst.write_text('External file content created concurrently')
                raise PermissionError("Simulated permission error on source unlink")
            return original_unlink(path, *args, **kwargs)

        with patch('os.unlink', side_effect=race_unlink):
            with self.assertRaises(OSError) as ctx:
                app.safe_move_file(src, dst)

        self.assertIn('rollback aborted', str(ctx.exception).lower())
        self.assertTrue(src.exists())
        self.assertTrue(dst.exists())
        self.assertEqual(dst.read_text(), 'External file content created concurrently')

    def test_cross_filesystem_rollback_preserves_externally_replaced_destination(self):
        """Cross-filesystem rollback preserves destination if replaced by an external process."""
        src = app.INBOX / 'xdev_src.txt'
        src.write_text('Cross-device source content')
        dst = app.ORGANIZED / 'Study' / 'xdev_src.txt'
        (app.ORGANIZED / 'Study').mkdir(parents=True, exist_ok=True)

        original_link = os.link
        def mock_link(s, d):
            if '.tmp-' not in str(s):
                err = OSError("Invalid cross-device link")
                err.errno = errno.EXDEV
                raise err
            return original_link(s, d)

        original_unlink = os.unlink
        def mock_unlink(path, *args, **kwargs):
            if str(path) == str(src):
                original_unlink(dst)
                dst.write_text('External replacement file')
                raise PermissionError("Simulated failure to delete source")
            return original_unlink(path, *args, **kwargs)

        with patch('os.link', side_effect=mock_link), patch('os.unlink', side_effect=mock_unlink):
            with self.assertRaises(OSError) as ctx:
                app.safe_move_file(src, dst)

        self.assertIn('rollback aborted', str(ctx.exception).lower())
        self.assertTrue(src.exists())
        self.assertTrue(dst.exists())
        self.assertEqual(dst.read_text(), 'External replacement file')

    def test_process_lock_guards_concurrent_instances(self):
        """Process lock ensures two servers cannot run against the same data directory."""
        temp_data = Path(tempfile.mkdtemp())
        try:
            lock1 = app.acquire_process_lock(temp_data)
            self.assertIsNotNone(lock1)
            # Second attempt while lock1 is held must raise BlockingIOError or OSError
            with self.assertRaises((BlockingIOError, OSError)):
                app.acquire_process_lock(temp_data)
            # After releasing, acquisition succeeds
            lock1.close()
            lock2 = app.acquire_process_lock(temp_data)
            self.assertIsNotNone(lock2)
            lock2.close()
        finally:
            shutil.rmtree(temp_data, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()

