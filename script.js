document.addEventListener("DOMContentLoaded", () => {
  const greetingText = document.getElementById("greetingText");
  const dateBox = document.getElementById("currentDate");

  const now = new Date();
  const hour = now.getHours();

  let greeting = "Hello";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  else greeting = "Good evening";

  if (greetingText) {
    greetingText.textContent = greeting + ",";
  }

  if (dateBox) {
    const formatted = now.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    dateBox.textContent = formatted;
  }
});
