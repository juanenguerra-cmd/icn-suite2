import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
};

export function SimplePage({ title, subtitle }: Props) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {subtitle ? <div className="muted mini">{subtitle}</div> : null}
      <div className="sep" />
      <div className="muted">
        Placeholder. We'll migrate this module's UI + logic next.
      </div>
    </div>
  );
}
