// ==UserScript==
// @name                DoubanPostEmotionDetection
// @name:zh-cn          利用 ChatGPT 对豆瓣帖子进行情绪分类过滤
// @namespace           https://github.com/JimSunJing
// @version             0.1.1
// @description         Identify and filter post emotion using ChatGPT. Target page: www.douban.com/group/
// @description:zh-cn   保存豆瓣广播内容到本地. 需要打开 douban.com/mine/statuses
// @author              JimSunJing
// @include             https://www.douban.com/group/*
// @exclude             https://www.douban.com/group/*/topic
// @exclude             https://www.douban.com/group/search*
// @exclude             https://www.douban.com/group/topic/*
// @require             https://unpkg.com/axios/dist/axios.min.js
// @license             MIT
// @grant GM_setValue
// @grant GM_getValue
// ==/UserScript==

(() => {
  "use strict";
  // ask user to set openAI api key
  const requireApiKey = () => {
    // use GM_setValue to store api key
    let secret = prompt("请输入你的 Open AI api 密匙");
    if (secret) {
      GM_setValue("OPENAI_API_KEY", secret);
      return true;
    } else {
      console.log("no input.");
      return false;
    }
  };

  // store posts
  class Data {
    constructor() {
      this.postStore = [];
      this.analyseResult = [];
    }

    addPost(posts) {
      this.postStore = this.postStore.concat(posts);
    }

    clearPost() {
      this.postStore = [];
    }

    setAnalyseResult(result) {
      this.analyseResult = result;
    }
  }

  const current = new Data();

  // extract douban group post title list from current page
  const getPosts = () => {
    if (current.postStore.length > 0) {
      console.log("already parsed posts");
      return;
    }

    // get all elements with class name 'td-subject'
    const tdSubjects = document.querySelectorAll(".td-subject");

    // convert nodelist to array
    const posts = [];

    tdSubjects.forEach((tdSubject) => {
      const parentElement = tdSubject.parentNode;
      posts.push({
        id: tdSubject.children[0].getAttribute("href").split("/")[5],
        title: tdSubject.textContent.trim(),
        href: tdSubject.children[0].getAttribute("href"),
        parentRef: parentElement,
      });
    });

    current.clearPost();
    current.addPost(posts);
    console.log("posts", current.postStore);
  };

  // load init button to Page HTML
  // inject style
  const injectStyle = () => {
    const style = document.createElement("style");
    style.innerHTML = `
      .greasy-button {
        background-color: #edf4ed;
        color: black;
        padding: 3px 6px;
        margin: 3px;
        border-radius: 7px;
        border: none;
      }
      .newContainer {
        width: 90%;
        height: 26px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        background-color: #fff6ed;
        padding: 10px;
        margin: 10px 10px;
        border-radius: 10px;
        font-size: 14px;
      }
      .newInput {
        margin: 3px 0px;
        padding: 3px;
        width: 70%;
        border: 1px solid;
      }
      .newInput:hover {
        outline: none
      }
    `;
    document.head.appendChild(style);
  };

  // create button
  const createBtn = (text = "") => {
    let btn = document.createElement("button");
    btn.classList.add("greasy-button");
    btn.innerText = text;
    return btn;
  };

  // create checkbox
  const createEmotionCheckBox = (container) => {
    let checkboxLabels = ["积极", "中立", "负面"];
    let checkboxNames = ["positive", "neutral", "negative"];

    for (let i = 0; i < checkboxLabels.length; i++) {
      let label = document.createElement("label");
      let checkbox = document.createElement("input");
      checkbox.classList.add("emotion-checkbox");
      checkbox.type = "checkbox";
      checkbox.name = checkboxNames[i];
      checkbox.checked = true;
      // disable before emotion check
      // checkbox.setAttribute("disabled");
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + checkboxLabels[i]));
      container.appendChild(label);

      checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
          console.log(checkbox.name, "is checked");
        } else {
          console.log(checkbox.name, "is not checked");
        }
      });
    }
  };

  const addScriptBtn = () => {
    // 在 我的小组讨论 下添加按钮
    const aside = document.querySelector(".aside");

    // 添加一个控制新增按钮的div
    const newContainer = document.createElement("div");
    newContainer.classList.add("newContainer");
    aside.insertBefore(newContainer, aside.firstChild);

    // 要求 ChatGPT 分析情绪按钮
    const analyse = createBtn("AI分析");
    analyse.addEventListener("click", analyseTitles);
    newContainer.appendChild(analyse);

    // 用户输入 API KEY 按钮
    const changeAPIKEY = createBtn("输入API密匙");
    changeAPIKEY.addEventListener("click", requireApiKey);
    newContainer.appendChild(changeAPIKEY);

    // 情绪分类选择 checkbox
    const checkboxWrap = document.createElement("div");
    checkboxWrap.classList.add("newContainer");
    createEmotionCheckBox(checkboxWrap);
    newContainer.insertAdjacentElement("afterend", checkboxWrap);

    // notification
    const notification = document.createElement("p");
    notification.id = "scriptNotification";
    notificationWrap.appendChild(notification);
    checkboxWrap.insertAdjacentElement("afterend", notification);
  };

  // create api connect session using axios
  const connectOpenAISession = () => {
    if (!GM_getValue("OPENAI_API_KEY")) {
      requireApiKey();
      return;
    }
    const apiKey = GM_getValue("OPENAI_API_KEY");
    return axios.create({
      baseURL: "https://api.openai.com/v1/",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  };

  // analyse with ChatGPT
  const analyseTitles = async () => {
    // get post titles
    getPosts();
    let prompt = `I want you to modify a JSON object array. You need to detect and classify each object's title text emotion, classify them into 3 types: 'positive', 'neutral', 'negative'. You need to add your classification result into the JSON object array as 'emotion' property, do not change other property. And then you need to only reply this JSON object array, when you reply you need to remove the title property. Only reply JSON object arrat, do not reply other text. Here are the JSON object array I provide: `;
    const titleJson = JSON.stringify(
      current.postStore.map((post, index) => ({
        title: post.title,
        id: post.id,
      }))
    );
    prompt += titleJson;
    console.log("prompt:", prompt);
    // connect to open AI api
    const openaiAxios = connectOpenAISession();
    if (!openaiAxios) {
      console.log("analyseTitles aborted");
    }
    // run title emotion analyse
    openaiAxios
      .post("chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      })
      .then((response) => {
        console.log(response.data);
        const data = response.data.choices[0].message.content;
        // Define the regex pattern
        const regex = /\[[^\]]*\{[^}]*\}[^\]]*\]/;

        // Use the RegExp 'exec' method to extract the JSON object array
        const match = regex.exec(data);

        if (match !== null) {
          // The regex matched at least one JSON object array, so we can extract it
          const jsonArray = JSON.parse(match[0]);

          console.log("parse result array:", jsonArray);
          current.setAnalyseResult(jsonArray);
        } else {
          throw new Error("No JSON object array found in the string.");
        }
      })
      .catch((error) => {
        console.error(error);
      });
    // save results, push finished notificatio to HTML
  };

  // hide unselected post
  const hidePost = () => {};

  const init = () => {
    console.log("Hello, Douban Post Emotion Detection");
    injectStyle();
    addScriptBtn();
  };

  init();
})();
