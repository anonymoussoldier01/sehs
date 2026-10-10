import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { TextArea } from '@heroui/react/textarea';
import { api } from '../lib/api';
import { useToast } from '../providers';

export default function Request() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    document.title = 'Request a resource — SEHS Study';
  }, []);
  const send = async (e) => {
    e.preventDefault();
    try {
      await api.request(title, detail);
      setMsg('Received — thank you.');
      setTitle('');
      setDetail('');
    } catch (err) {
      setMsg(err.message || 'Could not send.');
    }
  };
  const cls = 'rounded-[10px] border px-3 py-2.5 text-base';
  const st = { borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--txt)' };
  return (
    <div className="mx-auto max-w-[640px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Request a resource
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Request a resource</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Tell us what&apos;s missing — an administrator reviews every request. Please don&apos;t include personal details.
      </p>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Tip: <Link to="/search" className="font-bold underline" style={{ color: 'var(--acc)' }}>search the collection first</Link> — your resource may already be here under a different title.
      </p>
      <form onSubmit={send} className="mt-3 grid gap-2.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} maxLength={200} placeholder="What are you looking for? (e.g. 2023 ACER verbal reasoning)" aria-label="Request title" />
        <TextArea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} maxLength={1000} placeholder="Extra detail (optional)" aria-label="Extra detail" />
        <div>
          <Button type="submit" variant="primary">
            Send request
          </Button>{' '}
          <span className="text-[13px]">{msg}</span>
        </div>
      </form>
    </div>
  );
}
