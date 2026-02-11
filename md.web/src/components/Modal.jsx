import { Close } from '@mui/icons-material';
import { StatusIcon } from '../utils/muiIcons';

const Modal = ({ open, isOpen, title, icon, children, actions, onClose, size = 'medium' }) => {
  // Her iki prop'u da destekle: open veya isOpen
  const shouldShow = open || isOpen;
  if (!shouldShow) return null;

  // Backdrop tıklamasında kapat
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // Title'dan emoji'yi ayır ve icon olarak kullan
  const extractedIcon = icon || (typeof title === 'string' && title.match(/^[\u{1F300}-\u{1F9FF}]/u)?.[0]);
  const cleanTitle = typeof title === 'string' ? title.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '') : title;

  return (
    <div 
      className="modal-backdrop" 
      role="dialog" 
      aria-modal="true" 
      aria-label={cleanTitle || 'Dialog'}
      onClick={handleBackdropClick}
    >
      <div className={`modal modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {extractedIcon && <StatusIcon icon={extractedIcon} sx={{ fontSize: 22 }} />}
            {cleanTitle}
          </h3>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Kapat">
            <Close fontSize="small" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions ? <div className="modal-footer">{actions}</div> : null}
      </div>
    </div>
  );
};

export default Modal;
