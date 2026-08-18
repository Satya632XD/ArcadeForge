import React from 'react';
import { go } from '../api/router';

export default function Link({ to, children, className = '' }) {
  return <a className={className} href={to} onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); go(to); } }}>{children}</a>;
}
