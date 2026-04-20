export const normalizeWhatsappPhone = (phone: string) => {
  let cleanPhone = phone.replace(/[^\d+]/g, "");

  if (cleanPhone.startsWith("+")) {
    cleanPhone = cleanPhone.slice(1);
  }

  if (cleanPhone.startsWith("0")) {
    cleanPhone = "250" + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith("250")) {
    cleanPhone = "250" + cleanPhone;
  }

  return cleanPhone;
};

export const openWhatsApp = async (phone: string, message: string) => {
  const cleanPhone = normalizeWhatsappPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  const webUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  // Copy message to clipboard for fallback
  try {
    await navigator.clipboard.writeText(message);
  } catch (error) {
    console.warn("Could not copy message to clipboard:", error);
  }

  // Try to open WhatsApp
  const opened = window.open(webUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Fallback if popup blocked
    window.location.href = webUrl;
  }
};