import hashlib
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from server.app import create_app, transcribe_audio, JobStore

class WhisperBackendTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.app = create_app(self.root, start_worker=False, serve_frontend=False)
        self.client = TestClient(self.app)
        self.audio = b'original test audio bytes'
        self.digest = hashlib.sha256(self.audio).hexdigest()
        self.id = str(uuid4())

    def tearDown(self):
        self.client.close()
        self.temporary.cleanup()

    def submit(self, **updates):
        data = {'job_id': self.id, 'audio_sha256': self.digest, 'model': 'turbo', 'language': 'yo', 'region': 'West Africa', 'prompt': 'Iro nwanụ!'}
        data.update(updates)
        return self.client.post('/api/transcriptions', data=data, files={'audio': ('original.wav', self.audio, 'audio/wav')})

    def test_durable_idempotent_job_preserves_original_and_returns_timestamps(self):
        self.assertEqual(self.submit().status_code, 202)
        self.assertEqual(self.submit().status_code, 202)
        self.assertEqual(self.submit(model='large-v3').status_code, 409)
        self.assertEqual((self.root / f'{self.id}.audio').read_bytes(), self.audio)
        def fake(path, model, language, prompt):
            self.assertEqual(path.read_bytes(), self.audio)
            self.assertEqual((model, language), ('turbo', 'yo'))
            self.assertIn('Alo o!', prompt)
            return {'text':'Iro nwanụ!', 'language':'yo', 'segments':[{'start':0.0,'end':1.5,'text':'Iro nwanụ!'}]}
        self.assertTrue(self.app.state.jobs.run_one(fake))
        payload = self.client.get(f'/api/transcriptions/{self.id}').json()
        self.assertEqual(payload['status'], 'completed')
        self.assertEqual(payload['result']['audioSha256'], self.digest)
        self.assertEqual(payload['result']['segments'][0]['text'], 'Iro nwanụ!')
        self.assertFalse((self.root / f'{self.id}.audio').exists())
        self.assertEqual(self.submit().json()['status'], 'completed')

    def test_rejects_invalid_hash_model_language_and_cross_origin(self):
        self.assertEqual(self.submit(audio_sha256='0'*64).status_code, 422)
        self.assertEqual(self.submit(model='whisper-1').status_code, 422)
        self.assertEqual(self.submit(language='ny').status_code, 422)
        self.assertEqual(self.submit(job_id='../escape').status_code, 422)
        self.assertEqual(self.client.post('/api/transcriptions', headers={'Origin':'https://other.example'}, data={'job_id':self.id,'audio_sha256':self.digest,'model':'turbo'}, files={'audio':('x.wav',self.audio)}).status_code,403)
        self.assertEqual(len(list(self.root.glob('*.upload'))), 0)
        self.assertEqual(self.client.get('/api/transcriptions/unknown').status_code,404)

    def test_upload_limit_and_failed_inference_are_explicit(self):
        with patch('server.app.MAX_AUDIO_BYTES', 2):
            self.assertEqual(self.submit().status_code, 413)
        self.assertEqual(self.submit().status_code, 202)
        def fail(*args):
            raise RuntimeError('private internal error')
        self.app.state.jobs.run_one(fail)
        payload=self.client.get(f'/api/transcriptions/{self.id}').json()
        self.assertEqual(payload['status'],'failed')
        self.assertNotIn('result', payload)
        self.assertNotIn('private internal error', payload['error'])
        self.assertFalse((self.root / f'{self.id}.audio').exists())

    def test_restarts_requeue_incomplete_work(self):
        self.submit()
        with self.app.state.jobs.connect() as db:
            db.execute("UPDATE jobs SET status='running'")
        self.assertEqual(JobStore(self.root).get(self.id)['status'], 'queued')

    def test_real_runtime_adapter_disables_vad_and_translation(self):
        # Runtime model double: tests arguments, NOT speech-recognition quality.
        model=SimpleNamespace(transcribe=lambda *args,**kwargs: (iter([SimpleNamespace(start=0.0,end=1.0,text=' Alo o!')]),SimpleNamespace(language='yo')))
        with patch('faster_whisper.WhisperModel',return_value=model) as constructor, patch.dict(os.environ,{'WHISPER_ALLOW_DOWNLOAD':'0'}):
            with patch.object(model,'transcribe', wraps=model.transcribe) as call:
                result=transcribe_audio(Path('test.wav'),'large-v3','yo','Alo o!')
                self.assertEqual(call.call_args.kwargs['task'],'transcribe')
                self.assertFalse(call.call_args.kwargs['vad_filter'])
                self.assertEqual(call.call_args.kwargs['initial_prompt'],'Alo o!')
                self.assertTrue(constructor.call_args.kwargs['local_files_only'])
                self.assertEqual(result['text'],'Alo o!')

if __name__ == '__main__':
    unittest.main()
