import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="lost wrap" aria-labelledby="lost-title">
      <h1 id="lost-title" className="display">Nothing was built here.</h1>
      <dl className="tb">
        <div className="tb__cell"><dt className="label">Sheet</dt><dd className="tb__value">404</dd></div>
        <div className="tb__cell"><dt className="label">Status</dt><dd className="tb__value">Not found</dd></div>
        <div className="tb__cell"><dt className="label">Build</dt><dd className="tb__value">Kadjoe</dd></div>
      </dl>
      <div className="lost__actions">
        <Link prefetch={false} href="/projects" className="fill-btn">See the projects <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
