
/* =================================
   A LITTLE UNIVERSE
   Main interaction logic
================================= */

document.addEventListener("DOMContentLoaded", async () => {

    // Получаем элементы первой сцены
    const eyebrow = document.querySelector(".eyebrow");
    const title = document.querySelector(".scene-content h1");
    const description = document.querySelector(".intro-description");
    const startButton = document.getElementById("start-button");

    // Загружаем настройки сайта
    async function loadContent() {

        try {
            const response = await fetch("./content.json");

            if (!response.ok) {
                throw new Error("Failed to load content.json");
            }

            const content = await response.json();

            // Устанавливаем язык страницы
            document.documentElement.lang =
                content.site.language;

            // Устанавливаем название сайта
            document.title = content.site.title;

            // Заполняем первую сцену
            eyebrow.textContent = content.intro.eyebrow;
            title.textContent = content.intro.title;
            description.textContent = content.intro.description;
            startButton.textContent = content.intro.button;

            console.log("Content loaded successfully.");

        } catch (error) {

            console.error("Content loading error:", error);

        }
    }

    // Загружаем содержимое
    await loadContent();

    // Обрабатываем нажатие кнопки
    startButton.addEventListener("click", () => {

        console.log("The journey begins.");

        startButton.textContent = "Скоро...";
        startButton.disabled = true;

    });

});
