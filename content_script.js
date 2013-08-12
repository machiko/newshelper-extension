var censorNewsSite = function(baseNode) {
  if (window.location.href.toLowerCase().indexOf("news") !== -1) {
    console.log("censorPage()");
    var censorPage = function() {
      if ($(".newshelper-warning").length >= 1) {
        return;
      }

      var buildWarningMessage = function(description, tags) {
        return '<p class="newshelper-warning" style="background: hsl(0, 50%, 50%); color: white; font-size: large; text-align: center; width: 100%; padding: 5px 0;">' + 
          '[警告] 您可能是問題新聞的受害者！' + 
            '<span class="newshelper-description" style="font-size: small; display: block;">' +
              description +
            '</span>' +
            '<span class="newshelper-tags" style="font-size: small; display: block;>{' + 
              tags + 
            '</span>}' + 
          '</p>';
      };
    
      var titleText = $("title").text(),
          linkHref = window.location.href;

      /* validate the page title and link */
      var API_BASE = "http://taichung-chang-946908.middle2.me",
          API_ENDPOINT = "/api/check_news"
      var queryParams = {
        title: titleText,
        url: linkHref
      };
      $.getJSON(API_BASE + API_ENDPOINT, queryParams)
        .done(function(result) {
          if ($(".newshelper-warning").length < 1) {
            console.log("titleText: " + titleText + ", linkHref: " + linkHref);
            $("body").prepend(buildWarningMessage(result.description, result.tags));
          }
        });
    };
    censorPage();
  }
};

var get_newshelper_db = function(cb){
    if (null !== opened_db) {
	cb(opened_db);
	return;
    }

    var request = indexedDB.open('newshelper', '5');
    request.onsuccess = function(event){
	opened_db = request.result;
	cb(opened_db);
	return;
    };

    request.onerror = function(event){
	console.log("IndexedDB error: " + event.target.errorCode);
    };

    request.onupgradeneeded = function(event){
	try {
	    event.currentTarget.result.deleteObjectStore('read_news');
	} catch (e) {}
	var objectStore = event.currentTarget.result.createObjectStore("read_news", { keyPath: "id", autoIncrement: true });
	objectStore.createIndex("title", "title", { unique: false });
	objectStore.createIndex("link", "link", { unique: true });
	objectStore.createIndex("last_seen_at", "last_seen_at", { unique: false });

	try {
	    event.currentTarget.result.deleteObjectStore('report');
	} catch (e) {}
	var objectStore = event.currentTarget.result.createObjectStore("report", { keyPath: "id" });
	objectStore.createIndex("news_title", "news_title", { unique: false });
	objectStore.createIndex("news_link", "news_link", { unique: false });
    };
};

var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
var opened_db = null;

// 跟遠端 API server 同步回報資料
var sync_report_data = function(){
    get_newshelper_db(function(opened_db){
	// TODO: 要改成只抓有更新的部份
	$.get('http://kaohiung-wei-233594.middle2.me/index/data', function(ret){
		var transaction = opened_db.transaction("report", 'readwrite');
		var objectStore = transaction.objectStore("report");
		for (var i = 0; i < ret.data.length; i ++) {
		    objectStore.put(ret.data[i]);
		}
	}, 'json');
    });
};

var log_browsed_link = function(link, title) {
    if (!link) {
	return;
    }

    get_newshelper_db(function(opened_db){
	var transaction = opened_db.transaction("read_news", 'readwrite');
	var objectStore = transaction.objectStore("read_news");
	var request = objectStore.add({
	    title: title,
	    link: link,
	    last_seen_at: Math.floor((new Date()).getTime() /1000)
	});

	// link 重覆
	request.onerror = function(){
	    var transaction = opened_db.transaction("read_news", 'readwrite');
	    var objectStore = transaction.objectStore("read_news");
	    var index = objectStore.index('link');
	    var get_request = index.get(link);
	    get_request.onsuccess = function(){
		// update last_seen_at
		var put_request = objectStore.put({
		    id: get_request.result.id,
		    title: title,
		    last_seen_at: Math.floor((new Date()).getTime() /1000)
		});
	    };
	};
    });
};

// 從 db 中判斷 title, url 是否是錯誤新聞，是的話執行 cb 並傳入資訊
var check_report = function(title, url, cb){
    if (!url) {
	return;
    }
    get_newshelper_db(function(opened_db){
	var transaction = opened_db.transaction("report", 'readonly');
	var objectStore = transaction.objectStore("report");
	var index = objectStore.index('news_link');

	var get_request = index.get(url);
	get_request.onsuccess = function(){
	    if (get_request.result) {
		cb(get_request.result);
	    }
	};
    });
};

var buildWarningMessage = function(options){
    return '<p class="newshelper-warning" style="background: hsl(0, 50%, 50%); color: white; font-size: large; text-align: center">' +
	'[警告] 您可能是問題新聞的受害者！' +
	'<span class="newshelper-description" style="font-size: small; display: block;">' +
	$('<span></span>').append($('<a></a>').attr({href: options.link, target: '_blank'}).text(options.title)).html() +
	'</span>' +
	'</p>';
};

var censorFacebook = function(baseNode) {
  if (window.location.host.indexOf("www.facebook.com") !== -1) {
    /* log browsing history into local database for further warning */
    /* add warning message to a Facebook post if necessary */
    var censorFacebookNode = function(containerNode, titleText, linkHref) {
	var matches = ('' + linkHref).match('^http://www\.facebook\.com/l\.php\\?u=([^&]*)');
	if (matches) {
	    linkHref = decodeURIComponent(matches[1]);
	}
      var containerNode = $(containerNode);
      var className = "newshelper-checked";
      if (containerNode.hasClass(className)) {
        return;
      }
      else {
        containerNode.addClass(className);
      }

      /* log the link first */
      log_browsed_link(linkHref, titleText);

      check_report(titleText, linkHref, function(report){
	  containerNode.addClass(className);
	  containerNode.append(buildWarningMessage({
	      title: report.report_title,
	     link: report.report_link
	  }));
      });
    };


    /* my timeline */
    $(baseNode).find(".uiStreamAttachments").each(function(idx, uiStreamAttachment) {
      var uiStreamAttachment = $(uiStreamAttachment)
      if (!uiStreamAttachment.hasClass("newshelper-checked")) {
        var titleText = uiStreamAttachment.find(".uiAttachmentTitle").text();
        var linkHref = uiStreamAttachment.find("a").attr("href");
        censorFacebookNode(uiStreamAttachment, titleText, linkHref);
      }
    });

    /* others' timeline, fan page */
    $(baseNode).find(".shareUnit").each(function(idx, shareUnit) {
      var shareUnit = $(shareUnit);
      if (!shareUnit.hasClass("newshelper-checked")) {
        var titleText = shareUnit.find(".fwb").text();
        var linkHref = shareUnit.find("a").attr("href");
        censorFacebookNode(shareUnit, titleText, linkHref)
      };
    });

    /* post page (single post) */
    $(baseNode).find("._6kv").each(function(idx, userContent) {
      var userContent = $(userContent);
      if (!userContent.hasClass("newshelper-checked")) {
        var titleText = userContent.find(".mbs").text();
        var linkHref = userContent.find("a").attr("href");
        censorFacebookNode(userContent, titleText, linkHref);
      };
    });
  }
};

var registerObserver = function() {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
  var mutationObserverConfig = {
    target: document.getElementsByTagName("body")[0],
    config: {
      attributes: true,
      childList: true,
      characterData: true
    }
  };
  var mutationObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      censorFacebook(mutation.target);
      censorNewsSite(mutation.target);
    });
  });
  mutationObserver.observe(mutationObserverConfig.target, mutationObserverConfig.config);
}

var main = function() {
  $(function(){
    /* fire up right after the page loaded*/
    censorFacebook(document.body);
    censorNewsSite(document.body);
    sync_report_data();
  
    /* deal with changed DOMs (i.e. AJAX-loaded content) */
    registerObserver();
  });
};

main();
