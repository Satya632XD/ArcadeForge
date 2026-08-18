import React from 'react';
export default function Status({ kind = 'info', children }) { return <div className={`status ${kind}`}>{children}</div>; }
