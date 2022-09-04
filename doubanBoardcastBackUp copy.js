// ==UserScript==
// @name                SaveDoubanBoardcast
// @namespace           https://github.com/JimSunJing
// @version             0.1.0
// @description         Save douban Boardcast from douban website
// @description:zh-cn   保存豆瓣广播内容到本地
// @author              JimSunJing
// @match               https://www.douban.com/people/*/statuses*
// @require             https://unpkg.com/dexie/dist/dexie.js
// @license             MIT
// ==/UserScript==

(() => {
  'use strict';
  // 获取网页中每个广播对象
  let statuses;
  const DB_NAME = "dbBoardast";

  // inject style
  const injectStyle = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      .btnS {
        background-color: #edf4ed;
        color: black;
        padding: 3px 6px;
        margin: 3px;
        border-radius: 7px;
        border: none;
      }
      .newBtnContainer {
        background-color: #fff6ed;
        padding: 10px;
        margin: 30px 0px;
        border-radius: 10px
      }
      .newInput {
        margin: 3px 0px;
        padding: 3px;
        width: 70%;
      }
    `;
    document.head.appendChild(style);
  }

  // create button
  const createBtnS = (innerT = '') => {
    let btn = document.createElement("button");
    btn.classList.add("btnS");
    btn.innerText = innerT;
    return btn;
  }


  const addScriptBtn = () => {
    // 在网页旁边的用户信息栏下添加按钮
    const aside = document.querySelector(".aside");

    // 添加一个控制新增按钮的div
    const newBtnContainer = document.createElement("div");
    newBtnContainer.classList.add("newBtnContainer");
    aside.appendChild(newBtnContainer);
    
    // 开始备份信息的按钮
    const btnBackup = createBtnS("备份该页广播");
    btnBackup.addEventListener("click", saveDexie);
    
    newBtnContainer.appendChild(btnBackup);
    newBtnContainer.appendChild(document.createElement("br"));
    
    // 添加清空 Dexie 按钮
    const btnClearDexie = createBtnS("清空数据");
    btnClearDexie.addEventListener("click", clearDexie);
    
    newBtnContainer.appendChild(btnClearDexie);
    newBtnContainer.appendChild(document.createElement("br"));
    
    // 添加导出 csv 按钮
    const btnExportCSV = createBtnS("保存为csv");
    btnExportCSV.addEventListener("click", exportCSV);
    
    newBtnContainer.appendChild(btnExportCSV);
    newBtnContainer.appendChild(document.createElement("br"));
    
    // 添加设置 Notion 信息的按钮
    const btnNotionToken = createBtnS("输入Notion信息");
    btnNotionToken.addEventListener("click", notionInput);
    
    newBtnContainer.appendChild(btnNotionToken);
    newBtnContainer.appendChild(document.createElement("br"));
    
    // notification
    const noti = document.createElement("p");
    noti.id = 'scriptNoti';
    newBtnContainer.appendChild(noti);
    
    
    
    // 为每个广播添加伪删除按钮​
    for (let i = 0; i < statuses.length; i++) {
      // 创建隐藏按钮
      const container = document.createElement("div");
      container.style.display = 'flex';
      container.style.justifyContent = 'flex-end';

      const hide = createBtnS("隐藏");
      container.appendChild(hide);

      // 如果是转发的动态, 在按按钮的时候会跳转, 需要修改按钮位置
      if (/^status-real.*/.test(statuses[i].parentElement.className) && statuses[i - 1]) {
        hide.innerText = '↓隐藏↓';
        statuses[i - 1].appendChild(container);
        hide.addEventListener("click", () => {
          container.parentElement.nextElementSibling.remove();
          container.remove();
        })
      } else {
        statuses[i].appendChild(container);
        hide.addEventListener("click", () => {
          container.parentElement.remove();
        })
      }
      // console.log('appended hide:',i);

    }
  }


  const updateStatuses = () => {
    statuses = document.getElementsByClassName("status-item");
  }


  // 检查存储是否拥有 Notion 相关的 token 和 id
  const checkNotionToken = () => {
    const NOTION_TOKEN = localStorage.getItem("NOTION_TOKEN");
    const NOTION_DATABASEID = localStorage.getItem("NOTION_DATABASEID");
    if (!NOTION_TOKEN || NOTION_TOKEN.length === 0) {
      alert('NOTION INTEGRATION TOKEN 未输入');
      return false;
    }
    if (!NOTION_DATABASEID || NOTION_DATABASEID.length === 0) {
      alert("NOTION DATABASE ID 未输入");
      return false;
    }
    return [NOTION_TOKEN, NOTION_DATABASEID];
  }


  // 要求输入 Notion Token 和 Database Id
  const notionInput = () => {
    // add input
    let area = document.querySelector(".newBtnContainer");
    if (!area) {
      alert("脚本运行错误, 请刷新重试!");
      return null;
    }
    if (document.getElementById('notion-token-form') !== null) {
      return null;
    }
    let inputForm = document.createElement("form");
    inputForm.id = 'notion-token-form';
    inputForm.addEventListener("submit", e => {
      e.preventDefault();
      checkNotionInput('NOTION_TOKEN', inputForm.elements.NOTION_TOKEN);
      checkNotionInput('NOTION_DATABASEID', inputForm.elements.NOTION_DATABASEID);
    })
    area.appendChild(inputForm);

    let tokenInput = document.createElement("input");
    tokenInput.classList.add("newInput");
    tokenInput.setAttribute("placeholder", "输入 Notion Token");
    tokenInput.setAttribute("required", '');
    tokenInput.setAttribute("type", "text")
    tokenInput.setAttribute("name", "NOTION_TOKEN");
    inputForm.appendChild(tokenInput);

    let databaseIdInput = document.createElement("input");
    databaseIdInput.classList.add("newInput");
    databaseIdInput.setAttribute("placeholder", "输入Database id");
    databaseIdInput.setAttribute("required", '');
    databaseIdInput.setAttribute("type", "text");
    databaseIdInput.setAttribute("name", "NOTION_DATABASEID");
    inputForm.appendChild(databaseIdInput);

    let submitBtn = createBtnS("保存");
    submitBtn.setAttribute("type", "submit");
    inputForm.appendChild(document.createElement("br"));
    inputForm.appendChild(submitBtn);
    inputForm.appendChild(document.createElement("br"));
    
    let tips = document.createElement("p");
    tips.innerText = "不清楚请查看: \nnotion.so/my-integrations\nbilibili.com/video/BV17h411v7hm"
    inputForm.appendChild(tips);
  }

  // 检查并设置输入
  const checkNotionInput = (name, request) => {
    clearStorage(name);
    if (name === 'NOTION_TOKEN') {
      if (!request || !/^secret_\S{43}$/.test(request)) {
        alert(`${name}输入失败.格式不对, 应该是 'secret_' 开头的字符串\n不清楚可以查看教程:\ngithub.com/JimSunJing/somegreasyjs`);
      } else {
        localStorage.setItem(name, request);
      }
      console.log('token stored:', localStorage.getItem("NOTION_TOKEN") ? localStorage.getItem("NOTION_TOKEN").substring(0, 10) : '');
    } else if (name === 'NOTION_DATABASEID') {
      if (!request || !/^\S{32}$/.test(request)) {
        alert(`${name}输入失败.格式不对, 应该是 32 个字符的一串字符串, 比如:4374cc1974d749129faf91438039df08\n不清楚可以查看教程:\ngithub.com/JimSunJing/somegreasyjs`)
      } else {
        localStorage.setItem(name, request);
      }
      console.log('databaseId stored:', localStorage.getItem("NOTION_DATABASEID") ? localStorage.getItem("NOTION_DATABASEID").substring(0, 10) : '');
    }

  }

  const clearStorage = (name) => {
    localStorage.removeItem(name);
  }

  const notification = (msg) => {
    document.getElementById("scriptNoti").innerText = msg;
  }

  // 备份该页的广播信息
  const backupStatuses = () => {
    updateStatuses();

    // extract status info from web
    const savedStatuses = [];
    for (let i = 0; i < statuses.length; i++) {
      if (/deleted/.test(statuses[i].classList)){
        continue;
      }
      // extract pure text of status
      const match = statuses[i].innerText;
      const full = match ? match.replace('\n', '')
        .match(/^.*(?=\s\d*?回应.*)|^.+/s)[0] : "";
      let saying = "";
      if (match.indexOf("\n\n") > -1) {
        saying = match ? match.split('\n\n')[1] : "";
      } else {
        const t = match ? match.replace('\n', '')
          .match(/^(.*\s转发:)(.*)(?=\s\d*?回应.*)|^.+/s)[2] : "";
        saying = t ? t.match(/^.*(?=\n.*)/)[0] : "";
      }
      let uid, sid, time, link;
      // status sid
      sid = statuses[i].getAttribute("data-sid");
      // author uid
      uid = statuses[i].getAttribute("data-uid");
      if (uid === null) {
        uid = document.querySelector(".aside .content a").href
          .match(/(?<=https:\/\/www.douban.com\/people\/).*(?=\/)/);
      }
      link = `https://www.douban.com/people/${uid}/status/${sid}/`;
      // status create time
      time = statuses[i].querySelector(".created_at").getAttribute("title");

      let row = {
        id: sid,
        sid: sid,
        saying: saying,
        full: full,
        uid: uid,
        link: link,
        created: time
      }
      // img links
      let pics = statuses[i].querySelectorAll(".pics-wrapper img");
      // console.log('pics', i, ':', pics);
      if (pics && pics.length > 0) {
        // console.log('status', i, 'adding pics');
        for (let j = 0; j < pics.length; j++){
          row[`img${j}`] = pics[j].src;
        }
      }
      if (match) savedStatuses.push(row);
    }

    // save statuses in Dexie
    console.log('saved statuses', savedStatuses);
    return savedStatuses;
  }


  // save into Dexie
  const saveDexie = () => {
    const db = new Dexie(DB_NAME);

    db.version(1).stores({
      status: `
        id,sid,saying,full,uid,link,created
      `
    });

    const statuses = backupStatuses();
    db.status.bulkPut(statuses)
      .then(() => {
        console.log(`saved ${statuses.length} statuses.`);
        db.status.toCollection().count(count => {
          console.log(`Dexie current stores:`, count);
          notification(`已保存 ${count} 个广播.`);
        })
        let nextPage = document.querySelector(".paginator span.next a").href;
        const cont = localStorage.getItem("cont");
        if (nextPage && cont !== null && Number(cont) > 0) {
          nextPage = nextPage + `&cont=${Number(cont) - 1}`;
          localStorage.setItem("cont", Number(cont) - 1);
          window.location.href = nextPage;
        }
      }).catch(e => {
        console.error("error:", e);
      });
  
  }


  const clearDexie = () => {
    Dexie.delete(DB_NAME).then(() => {
      console.log("Database successfully deleted");
      notification("已清空保存的广播.");
    }).catch((err) => {
      console.error("Could not delete database",err);
    });
  }


  const exportCSV = () => {
    const db = new Dexie(DB_NAME);
    db.version(1).stores({
      status: `
        id,sid,saying,full,uid,link,created
      `
    });
    let pack = db.status.orderBy('created').reverse();
    pack.toArray().then(data => {
      data = data.map(e => {~
        delete e.id;
        return e;
      })

      let title = ['广播内容','广播带前缀','广播id','用户id','链接','时间','图片1','图片2',
      '图片3','图片4','图片5','图片6','图片7','图片8','图片9'];
      let key = ['saying','full','sid','uid','link','created', 'img0', 'img1','img2',
      'img3','img4','img5','img6','img7','img8'];

      JSonToCSV.setDataConver({
        data: data,
        fileName: 'test' + new Date().toISOString().
          replace(/(\d{4}-\d{2}-d{2})T(\d{2}:\d{2}):\d{3}Z$/,'$1_$2'),
        columns: {title, key}
      })
      console.log("pack:", data);
    })
  }

  const exportNotion = () => {
    const check = checkNotionToken();
    if (check && check.length === 2){
      const [TOKEN, DID] = check;
      
    }
  }


  // 导出CSV函数
  // https://github.com/liqingzheng/pc/blob/master/JsonExportToCSV.js
  let JSonToCSV = {
    /*
     * obj是一个对象，其中包含有：
     * ## data 是导出的具体数据
     * ## fileName 是导出时保存的文件名称 是string格式
     * ## showLabel 表示是否显示表头 默认显示 是布尔格式
     * ## columns 是表头对象，且title和key必须一一对应，包含有
          title:[], // 表头展示的文字
          key:[], // 获取数据的Key
          formatter: function() // 自定义设置当前数据的 传入(key, value)
     */
    setDataConver: function (obj) {
      var bw = this.browser();
      if (bw['ie'] < 9) return; // IE9以下的
      var data = obj['data'],
        ShowLabel = typeof obj['showLabel'] === 'undefined' ? true : obj['showLabel'],
        fileName = (obj['fileName'] || 'UserExport') + '.csv',
        columns = obj['columns'] || {
          title: [],
          key: [],
          formatter: undefined
        };
      ShowLabel = typeof ShowLabel === 'undefined' ? true : ShowLabel;
      var row = "",
        CSV = '',
        key;
      // 如果要现实表头文字
      if (ShowLabel) {
        // 如果有传入自定义的表头文字
        if (columns.title.length) {
          columns.title.map(function (n) {
            row += n + ',';
          });
        } else {
          // 如果没有，就直接取数据第一条的对象的属性
          for (key in data[0]) row += key + ',';
        }
        row = row.slice(0, -1); // 删除最后一个,号，即a,b, => a,b
        CSV += row + '\r\n'; // 添加换行符号
      }
      // 具体的数据处理
      data.map(function (n) {
        row = '';
        // 如果存在自定义key值
        if (columns.key.length) {
          columns.key.map(function (m) {
            row += '"' + (typeof columns.formatter === 'function' ? columns.formatter(m, n[m]) || n[m] || '' : n[m] || '') + '",';
          });
        } else {
          for (key in n) {
            row += '"' + (typeof columns.formatter === 'function' ? columns.formatter(key, n[key]) || n[key] || '' : n[key] || '') + '",';
          }
        }
        row = row.slice(0, row.length - 1); // 删除最后一个,
        CSV += row + '\r\n'; // 添加换行符号
      });
      if (!CSV) return;
      this.SaveAs(fileName, CSV);
    },
    SaveAs: function (fileName, csvData) {
      var bw = this.browser();
      if (!bw['edge'] || !bw['ie']) {
        var alink = document.createElement("a");
        alink.id = "linkDwnldLink";
        alink.href = this.getDownloadUrl(csvData);
        document.body.appendChild(alink);
        var linkDom = document.getElementById('linkDwnldLink');
        linkDom.setAttribute('download', fileName);
        linkDom.click();
        document.body.removeChild(linkDom);
      } else if (bw['ie'] >= 10 || bw['edge'] == 'edge') {
        var _utf = "\uFEFF";
        var _csvData = new Blob([_utf + csvData], {
          type: 'text/csv'
        });
        navigator.msSaveBlob(_csvData, fileName);
      } else {
        var oWin = window.top.open("about:blank", "_blank");
        oWin.document.write('sep=,\r\n' + csvData);
        oWin.document.close();
        oWin.document.execCommand('SaveAs', true, fileName);
        oWin.close();
      }
    },
    getDownloadUrl: function (csvData) {
      var _utf = "\uFEFF"; // 为了使Excel以utf-8的编码模式，同时也是解决中文乱码的问题
      if (window.Blob && window.URL && window.URL.createObjectURL) {
        csvData = new Blob([_utf + csvData], {
          type: 'text/csv'
        });
        return URL.createObjectURL(csvData);
      }
      // return 'data:attachment/csv;charset=utf-8,' + _utf + encodeURIComponent(csvData);
    },
    browser: function () {
      var Sys = {};
      var ua = navigator.userAgent.toLowerCase();
      var s;
      (s = ua.indexOf('edge') !== -1 ? Sys.edge = 'edge' : ua.match(/rv:([\d.]+)\) like gecko/)) ? Sys.ie = s[1] :
        (s = ua.match(/msie ([\d.]+)/)) ? Sys.ie = s[1] :
          (s = ua.match(/firefox\/([\d.]+)/)) ? Sys.firefox = s[1] :
            (s = ua.match(/chrome\/([\d.]+)/)) ? Sys.chrome = s[1] :
              (s = ua.match(/opera.([\d.]+)/)) ? Sys.opera = s[1] :
                (s = ua.match(/version\/([\d.]+).*safari/)) ? Sys.safari = s[1] : 0;
      return Sys;
    }
  };


  const init = () => {
    setTimeout(() => {
      if (document.querySelector('.pl2') !== null) {
        injectStyle();
        updateStatuses();
        addScriptBtn();
      }
    }, 500)
  }

  // 自动翻页判断
  if (location.href.indexOf('cont=') > -1) {
    // 自动翻页保存
    saveDexie();
  } else {
    // 初次使用 && 自定义页面
    clearStorage("cont");
    init();
  }

})();
