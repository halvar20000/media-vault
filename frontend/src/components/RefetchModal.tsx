import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RefetchFields {
  title: boolean;
  cover: boolean;
  text: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (fields: RefetchFields) => void;
}

// "Re-fetch all" dialog: pick which fields to overwrite (title / cover / text).
// Lets a user pull, say, only the localized title after switching TMDB language,
// without disturbing covers they're happy with.
export function RefetchModal({ open, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<RefetchFields>({ title: false, cover: true, text: true });

  // Reset to a sensible default each time it opens.
  useEffect(() => {
    if (open) setFields({ title: false, cover: true, text: true });
  }, [open]);

  if (!open) return null;

  const toggle = (k: keyof RefetchFields) => setFields((f) => ({ ...f, [k]: !f[k] }));
  const none = !fields.title && !fields.cover && !fields.text;

  const rows: { key: keyof RefetchFields; label: string; hint: string }[] = [
    { key: 'title', label: t('refetch.fieldTitle'), hint: t('refetch.fieldTitleHint') },
    { key: 'cover', label: t('refetch.fieldCover'), hint: t('refetch.fieldCoverHint') },
    { key: 'text', label: t('refetch.fieldText'), hint: t('refetch.fieldTextHint') },
  ];

  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box" style={{ maxWidth: 460 }}>
        <div className="mtop">
          <h3>{t('refetch.title')}</h3>
          <button className="close" style={{ position: 'static' }} onClick={onClose}>✕</button>
        </div>

        <div className="mbody">
          <p className="setintro">{t('refetch.intro')}</p>

          <div className="setgroup">
            {rows.map((r) => (
              <label key={r.key} className="setrow">
                <input type="checkbox" checked={fields[r.key]} onChange={() => toggle(r.key)} />
                <span className="setrowtext">
                  <b>{r.label}</b>
                  <span className="setrowhint">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="mnote">{t('refetch.note')}</p>

          <div className="mactions">
            <button className="ghostbtn" onClick={onClose}>{t('refetch.cancel')}</button>
            <button className="primary" disabled={none} onClick={() => onConfirm(fields)}>
              {t('refetch.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
