import Swal from "sweetalert2";

const colors = {
  primary: "#3498db",
  danger: "#e74c3c",
  success: "#27ae60",
  text: "#2c3e50",
};

export const showSuccess = (message) => {
  return Swal.fire({
    title: "Ottimo!",
    text: message,
    icon: "success",
    confirmButtonColor: colors.primary,
    confirmButtonText: "Ok",
    background: "#fff",
    color: colors.text,
    borderRadius: "12px",
  });
};

export const showError = (message) => {
  return Swal.fire({
    title: "Ops...",
    text: message,
    icon: "error",
    confirmButtonColor: colors.primary,
    confirmButtonText: "Chiudi",
    background: "#fff",
    color: colors.text,
  });
};

export const showConfirm = async (title, text) => {
  const result = await Swal.fire({
    title: title || "Sei sicuro?",
    text: text || "Questa azione non è reversibile!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: colors.danger,
    cancelButtonColor: colors.primary,
    confirmButtonText: "Sì",
    cancelButtonText: "Annulla",
    background: "#fff",
    color: colors.text,
    reverseButtons: true,
  });

  return result.isConfirmed;
};
