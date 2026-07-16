/* eslint-disable react/prop-types */
import { useState } from "react";
import ModalWithBody from "../admin/ModalWithBody";

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
        <ModalWithBody
          onConfirm={handleClose}
          onConfirmLabel="Close"
          onBackdrop={handleClose}
          heading=""
          additionalClasses="research-team-testimonial-modal !pt-[20px] !pb-[20px]"
        >
          <div className="research-team-testimonial-modal-content">
            <div className="research-team-testimonial-modal-media">
              <div className="research-team-testimonial-modal-image-wrapper">
                {imagePath && <img src={imagePath} alt={name} />}
              </div>
              <div className="research-team-testimonial-modal-person">
                <p className="research-team-testimonial-modal-name">{name}</p>
                <p className="research-team-testimonial-modal-position">{position}</p>
              </div>
            </div>

            <div className="research-team-testimonial-modal-copy">
              <p>{testimonial}</p>
            </div>
          </div>
        </ModalWithBody>
      )}
    </div>
  );
};
export default TestimonialItem;
