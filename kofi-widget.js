(() => {
  "use strict";

  const dialog = document.getElementById("kofi-dialog");
  const closeButton = document.getElementById("kofi-dialog-close");
  if (!(dialog instanceof HTMLDialogElement) || !(closeButton instanceof HTMLButtonElement)) return;

  let opener = null;

  const openDialog = (trigger) => {
    opener = trigger;
    if (!dialog.open) dialog.showModal();
  };

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest(".kofi-support-button")
      : null;
    if (!trigger) return;
    event.preventDefault();
    openDialog(trigger);
  });

  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    if (opener instanceof HTMLElement) opener.focus();
    opener = null;
  });
})();
