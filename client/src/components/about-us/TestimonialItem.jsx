/* eslint-disable react/prop-types */
import { useState } from "react";
import PublicFullscreenModal from "../PublicFullscreenModal";

const TestimonialItem = ({ name, position, image, testimonial }) => {
  const [isOpen, setIsOpen] = useState(false);
  const imagePath = image ? "/assets/research-team/" + image : null;

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <div className="testimonial-item research-team-testimonial-item">
      <div
        className="testimonial-item-card"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
      >
        <div className="testimonial-image-wrapper">
          {imagePath && <img src={imagePath} alt={name} />}
        </div>
        <div className="testimonial-body">
          <p className="testimonial-name">{name}</p>
          <p className="testimonial-position">{position}</p>
        </div>
      </div>

      {isOpen && (
        <PublicFullscreenModal
          ariaLabel={`${name}, ${position}`}
          onClose={handleClose}
          panelClassName="public-team-modal"
        >
          <div className="public-team-modal__content">
            <div className="public-team-modal__media">
              <div className="public-team-modal__image-wrapper">
                {imagePath && <img src={imagePath} alt={name} />}
              </div>
              <div className="public-team-modal__person">
                <p className="public-team-modal__name">{name}</p>
                <p className="public-team-modal__position">{position}</p>
              </div>
            </div>

            <div className="public-team-modal__copy">
              <p>{testimonial}</p>
            </div>
          </div>
        </PublicFullscreenModal>
      )}
    </div>
  );
};
export default TestimonialItem;
