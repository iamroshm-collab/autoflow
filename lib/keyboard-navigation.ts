/**
 * Sets up keyboard navigation for form inputs with dropdown lists
 * - ArrowDown: Move focus from input to first button/li in dropdown
 * - Enter on button/li: Select item, update input, move focus to next input
 * - Escape on button/li: Close dropdown, return focus to input
 */
export function setupFormKeyboardNavigation(formContainer: HTMLElement | null) {
  if (!formContainer) return;

  const inputs = formContainer.querySelectorAll('input[data-dropdown-trigger]');

  inputs.forEach((input) => {
    input.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      // If ArrowDown is pressed and dropdown is visible
      if (keyEvent.key === 'ArrowDown') {
        const inputEl = input as HTMLInputElement;
        const dropdownId = inputEl.getAttribute('data-dropdown-id');
        const dropdown = document.getElementById(dropdownId || '');

        if (dropdown && dropdown.style.display !== 'none') {
          keyEvent.preventDefault();

          // Find first button or li in dropdown
          const firstItem = dropdown.querySelector('button, li') as HTMLElement | null;
          if (firstItem) {
            firstItem.focus();
            firstItem.setAttribute('tabindex', '0');
          }
        }
      }
    });
  });

  // Handle button/li items in dropdowns
  const dropdownItems = formContainer.querySelectorAll(
    '[role="listbox"] li, [role="listbox"] button, [data-dropdown-item], [data-dropdown-item] li, [data-dropdown-item] button'
  );

  dropdownItems.forEach((item) => {
    item.setAttribute('tabindex', '-1');

    item.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;

      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault();

        // Get the dropdown parent
        const dropdown = item.closest('[id^="dropdown"], [data-dropdown-id]');
        if (dropdown) {
          const dropdownId = dropdown.id || dropdown.getAttribute('data-dropdown-id');
          const associatedInput = formContainer.querySelector(
            `input[data-dropdown-id="${dropdownId}"]`
          ) as HTMLInputElement | null;

          if (associatedInput) {
            // Update input value from item content
            const itemValue = (item as HTMLElement).textContent?.trim() || '';
            associatedInput.value = itemValue;

            // Trigger change event
            associatedInput.dispatchEvent(
              new Event('change', { bubbles: true })
            );

            // Find next input and focus it
            const inputs = Array.from(
              formContainer.querySelectorAll('input[data-dropdown-trigger]')
            ) as HTMLInputElement[];
            const currentInputIndex = inputs.indexOf(associatedInput);
            const nextInput = inputs[currentInputIndex + 1];

            if (nextInput) {
              nextInput.focus();
            }

            // Close dropdown
            if (dropdown) {
              (dropdown as HTMLElement).style.display = 'none';
            }
          }
        }
      }

      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault();

        // Close dropdown and return focus to input
        const dropdown = item.closest('[id^="dropdown"], [data-dropdown-id]');
        if (dropdown) {
          const dropdownId = dropdown.id || dropdown.getAttribute('data-dropdown-id');
          (dropdown as HTMLElement).style.display = 'none';
          const associatedInput = formContainer.querySelector(
            `input[data-dropdown-id="${dropdownId}"]`
          ) as HTMLInputElement | null;
          if (associatedInput) {
            associatedInput.focus();
          }
        }
      }

      // Arrow navigation within dropdown
      if (keyEvent.key === 'ArrowDown' || keyEvent.key === 'ArrowUp') {
        keyEvent.preventDefault();
        const dropdown = item.closest('[id^="dropdown"], [data-dropdown-id]');
        if (dropdown) {
          const items = Array.from(
            dropdown.querySelectorAll('button, li')
          ) as HTMLElement[];
          const currentIndex = items.indexOf(item as HTMLElement);

          let nextIndex = currentIndex;
          if (keyEvent.key === 'ArrowDown') {
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          }

          items[nextIndex].focus();
        }
      }
    });
  });
}
