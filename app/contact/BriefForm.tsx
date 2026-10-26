'use client';

import React from 'react';
import { contactPage, site } from '@/lib/content';

/**
 * BriefForm — the "start a build" brief.
 * No backend: on submit we compose a mailto: to hi@cato-labs.com with
 * the brief baked into subject + body, and let the visitor's mail client
 * carry it. The page stays a server component; this is the tiny client
 * island that owns the form.
 */
export default function BriefForm() {
  const f = contactPage.form;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const val = (k: string) => String(data.get(k) ?? '').trim();
    const name = val('name');
    const company = val('company');
    const email = val('email');
    const message = val('message');

    const subject = `New build brief — ${company || name || site.name}`;
    const body = [
      `${f.fields.name}: ${name}`,
      `${f.fields.company}: ${company}`,
      `${f.fields.email}: ${email}`,
      '',
      message,
    ].join('\n');

    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form className="contact-brief" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="brief-name">{f.fields.name}</label>
        <input id="brief-name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="brief-company">{f.fields.company}</label>
        <input id="brief-company" name="company" type="text" autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="brief-email">{f.fields.email}</label>
        <input id="brief-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="brief-message">{f.fields.message}</label>
        <textarea id="brief-message" name="message" rows={5} required />
      </div>
      <div className="contact-submit-row">
        <button type="submit" className="btn btn--blue">
          {f.submit}
          <span className="btn-arrow" aria-hidden="true">
            →
          </span>
        </button>
        <p className="contact-note">{f.note}</p>
      </div>
    </form>
  );
}
