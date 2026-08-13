import { useTranslation } from 'react-i18next';
import { CHANGELOG } from '../changelog';

export function ChangelogModal({
  open,
  current,
  onClose,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="mtop">
          <h3>{t('changelog.title')}</h3>
          <button className="close" style={{ position: 'static' }} onClick={onClose}>✕</button>
        </div>
        <div className="mbody">
          {CHANGELOG.map((r) => (
            <div key={r.version} className="clog">
              <div className="cloghead">
                <span className="clogver">v{r.version}</span>
                {r.version === current && <span className="clognow">{t('changelog.current')}</span>}
                <span className="clogdate">{r.date}</span>
              </div>
              {r.title && <p className="clogtitle">{r.title}</p>}
              <ul className="cloglist">
                {r.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
