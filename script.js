
/* =================================
   A LITTLE UNIVERSE
   Content and scene management
================================= */

document.addEventListener("DOMContentLoaded", async () => {

    // Получаем все сцены
    const scenes = {
        intro: document.getElementById("intro"),
        flower: document.getElementById("flower"),
        space: document.getElementById("space"),
        jupiter: document.getElementById("jupiter"),
        story: document.getElementById("story"),
        meeting: document.getElementById("meeting")
    };

    // Получаем кнопки
    const startButton = document.getElementById("start-button");

    // Хранилище настроек сайта
    let content = null;


    // Загружаем JSON
    async function loadContent() {

        try {

            const response = await fetch("./content.json");

            if (!response.ok) {
                throw new Error("Failed to load content.json");
            }

            content = await response.json();

            document.documentElement.lang =
                content.site.language;

            document.title =
                content.site.title;

            console.log("Content loaded successfully.");

            return true;

        } catch (error) {

            console.error("Content loading error:", error);

            return false;

        }
    }


    // Заполняем содержимое сцен
    function fillScenes() {

        // INTRO
        document.querySelector(".eyebrow").textContent =
            content.intro.eyebrow;

        scenes.intro.querySelector("h1").textContent =
            content.intro.title;

        scenes.intro.querySelector(".intro-description").textContent =
            content.intro.description;

        startButton.textContent =
            content.intro.button;


        // FLOWER
        document.getElementById("flower-title").textContent =
            content.flower.title;

        document.getElementById("flower-text").textContent =
            content.flower.text;


        // SPACE
        document.getElementById("space-title").textContent =
            content.space.title;

        document.getElementById("space-text").textContent =
            content.space.text;


        // JUPITER
        document.getElementById("jupiter-title").textContent =
            content.jupiter.title;

        document.getElementById("jupiter-text").textContent =
            content.jupiter.text;


        // STORY
        document.getElementById("story-title").textContent =
            content.story.title;

        document.getElementById("story-text").textContent =
            content.story.text;


        // MEETING
        document.getElementById("meeting-title").textContent =
            content.meeting.title;

        document.getElementById("meeting-description").textContent =
            content.meeting.description;

        document.getElementById("accept-button").textContent =
            content.meeting.accept;

        document.getElementById("decline-button").textContent =
            content.meeting.decline;

    }


    // Показываем выбранную сцену
    function showScene(sceneName) {

        Object.values(scenes).forEach(scene => {
            scene.hidden = true;
        });

        scenes[sceneName].hidden = false;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    // Запускаем первую сцену
    const loaded = await loadContent();

    if (!loaded) {
        return;
    }

    fillScenes();


    // Начало путешествия
    startButton.addEventListener("click", () => {

        showScene("flower");

    });

});
