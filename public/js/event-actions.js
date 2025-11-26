// Add delete buttons to event cards using JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Find all event cards
    const eventCards = document.querySelectorAll('.event-card');

    eventCards.forEach(card => {
        // Find the button container
        const buttonContainer = card.querySelector('.d-flex.justify-content-end');

        if (buttonContainer) {
            // Get the event ID from the Edit button's data-bs-target
            const editButton = buttonContainer.querySelector('button[data-bs-target]');
            if (editButton) {
                const target = editButton.getAttribute('data-bs-target');
                const eventId = target.replace('#editEventModal', '');

                // Create delete form
                const deleteForm = document.createElement('form');
                deleteForm.action = `/events/delete/${eventId}`;
                deleteForm.method = 'POST';
                deleteForm.style.display = 'inline';
                deleteForm.style.marginLeft = '0.5rem';

                // Create delete button
                const deleteButton = document.createElement('button');
                deleteButton.type = 'submit';
                deleteButton.className = 'delete-event-btn';
                deleteButton.textContent = 'Delete';
                deleteButton.onclick = function (e) {
                    if (!confirm('Are you sure you want to delete this event?')) {
                        e.preventDefault();
                        return false;
                    }
                };

                deleteForm.appendChild(deleteButton);
                buttonContainer.appendChild(deleteForm);
            }
        }
    });
});
