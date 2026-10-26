const commonlyUsedPasswords = new Set([
  "1234567890",
  "contraseña",
  "milyfe",
  "password",
  "password123",
  "qwertyuiop",
]);

function characterGroupCount(password: string) {
  return [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
}

export function getPasswordPolicyError(password: string, email: string) {
  if (password.length < 12 || password.length > 128) {
    return "La contraseña debe tener entre 12 y 128 caracteres.";
  }

  const normalizedPassword = password.toLowerCase();
  const localPart = email.trim().toLowerCase().split("@", 1)[0];
  if (localPart && localPart.length >= 3 && normalizedPassword.includes(localPart)) {
    return "La contraseña no debe contener tu correo electrónico.";
  }

  if (commonlyUsedPasswords.has(normalizedPassword)) {
    return "Elige una contraseña menos predecible.";
  }

  if (characterGroupCount(password) < 3) {
    return "Combina al menos tres de estos grupos: mayúsculas, minúsculas, números y símbolos.";
  }

  return null;
}
