
/* =================================
   A LITTLE UNIVERSE
   Main interaction logic
================================= */

document.addEventListener("DOMContentLoaded", () => {

    // Получаем кнопку начала путешествия
    const startButton = document.getElementById("start-button");

    // Проверяем, существует ли кнопка
    if (!startButton) {
        console.error("Start button not found");
        return;
    }

    // Обработка нажатия
    startButton.addEventListener("click", () => {

        console.log("The journey begins.");

        // Пока показываем временное сообщение
        startButton.textContent = "Coming soon...";

        startButton.disabled = true;

    });

});
