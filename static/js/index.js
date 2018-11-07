'use strict';

/* ===== Configuration ======== */
var API_KEY = "";  // API KEY HERE!
var SEARCH_DELAY = 500;  // in milliseconds
var SLIDER_INTERVAL = 500;  // in ms
var SCROLL_TRIGGER = 300;  // in pixels, before hitting the bottom

/* ============= Global Variables ============= */
var state = "watching";
var player = null;
var videoDuration = null;
var lastKeystroke = null;
var prev_state = null;
var searchResults = {};
var queue = [];
var nextPageToken = null;
var sliderInUse = false;
var isSearching = false;

var autolinker = new Autolinker({twitter: false, hashtag: false});

window.onload = function() {
    //set up queue here
    loadUserData();

}


function loadUserData(){
    var xmlHttp = new XMLHttpRequest();

    var url = '/userData'
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState != 4 || xmlHttp.status != 200)  // check if it's successfull and completely loaded
            return;

        var response = JSON.parse(xmlHttp.responseText);
        console.log(response);
        document.getElementById("profilePicture").setAttribute("src",response.picture);
        document.getElementById("profileName").innerHTML=response.Surname;
        if(response.playlist!= null){
        if(response.playlist.constructor === Array){
        queue=response.playlist.map(JSON.parse);
        }else{
        queue=[JSON.parse(response.playlist)];
        }
        }
        var videoID = window.location.hash.slice(1, 1 + 11)
        if (videoID.length == 11)
            loadVideo(videoID);
        else{
            console.log(queue);
            if(queue.length==0){
                hidePlaylist();
            };
        }
        setInterval(updateSlider, SLIDER_INTERVAL);
        setInterval(function() {
            var state = player.getPlayerState();

            if (state != prev_state)
                video_onStateChange();

            prev_state = player.getPlayerState();
        }, 50);
        refreshQueue()


    };

    xmlHttp.open('GET', url, true);
    xmlHttp.send(null);
}




function saveUserPlaylist(){
    var xmlHttp = new XMLHttpRequest();

    var url = '/myPlaylist'
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState != 4 || xmlHttp.status != 200)  // check if it's successfull and completely loaded
            return;
    };
    xmlHttp.open('POST', url, true);
    xmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    var queryString = "";
   for(var i = 0; i < queue.length; i++) {
       queryString += "playlist=" + JSON.stringify(queue[i]);

       //Append an & except after the last element
       if(i < queue.length - 1) {
          queryString += "&";
       }
   }

    xmlHttp.send(queryString);
}



function loadVideo(videoId) {
    if (player) {
        player.destroy();
    }
    var page_content = document.getElementsByClassName("page-content")[0];
    player = new YT.Player('player', {
        videoId: videoId,
        width: 0,
        height: 0,
        events: {
          'onReady': video_onReady,
        },
        playerVars: {  // For details: https://developers.google.com/youtube/player_parameters?playerVersion=HTML5
          autohide: 1,
          showinfo: 0,
          disablekb: 1,
          iv_load_policy: 3,
          rel: 0
        }
    });
    document.getElementById('player').style.display = "none";
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState != 4 || xmlHttp.status != 200)  // check if it's successfull and completely loaded
            return;

        var response = JSON.parse(xmlHttp.responseText);

        var video_title = document.getElementById("video-title");
        document.getElementById("slider");

        video_title.textContent = response.items[0].snippet.title;

        document.getElementById("playArt").setAttribute("src",response.items[0].snippet.thumbnails.high.url);
        slider.setAttribute("max", parseDuration(response.items[0].contentDetails.duration));
        videoDuration=parseDuration(response.items[0].contentDetails.duration)
        slider.value = 0;
        if (player.isMuted()) {
            player.unMute();
        }


    };

    xmlHttp.open("GET", "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=" + videoId + "&key=" + API_KEY, true);
    xmlHttp.send(null);
}


function nextVideo() {
    if (queue.length) {
        var video=queue[0]
        changeVideo(queue.shift().id.videoId);
        queue.push(video);
        refreshQueue();
    }
    else {
        player.stopVideo();
        updateSlider();
    }
}


function updateSlider() {
    if (sliderInUse)
        return;

    var slider = document.getElementById("slider");
    slider.value=player.getCurrentTime();
    document.getElementById("time").innerHTML=parseToMin(player.getCurrentTime())+"/"+parseToMin(videoDuration);
}

function parseToMin(value){
    value=parseInt(value);
    return parseInt(value/60)+":"+ value%60
}

function enterSearch() {
    if (state === "searching")
        return;

    state = "searching";
}




function search(nodelay, nextPage) {
    var date = new Date();

    if (!nodelay && date.getTime() - lastKeystroke < SEARCH_DELAY)
        return;

    if (isSearching)
        return;

    isSearching = true;

    var search_i = document.getElementById("search");
    console.log(search_i);

    var xmlHttp = new XMLHttpRequest();

    var url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=' + encodeURIComponent(search_i.value) + '&type=video&maxResults=10&key=' + API_KEY;
    if (nextPage && nextPageToken)
        url += '&pageToken=' + nextPageToken;

    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState != 4 || xmlHttp.status != 200)  // check if it's successfull and completely loaded
            return;

        var response = JSON.parse(xmlHttp.responseText);

        nextPageToken = response.nextPageToken;

        for (var i=0; i < response.items.length; ++i) {
            var item = response.items[i];

            searchResults[item.id.videoId] = item;
        }

        refreshSearchResults();
        isSearching = false;
    };

    xmlHttp.open('GET', url, true);
    xmlHttp.send(null);

    if (!nextPage)
        searchResults = {};
}

function refreshSearchResults() {


    var searchResultTemplate =  '  <tr class="{classSong}">\
            <td>{title}</td>\
                <td></td>\
                <td><a onclick="add_onClick(\'{videoID}\')" title="Add to queue">\
                 {plusButton}\
                </a></td>\
                <td></td>\
            </tr>';

    var search_results = document.getElementById("search-results");

    search_results.innerHTML = '';
    for (var itemID in searchResults) {
        var classAdd = "";
        var plusButtonValue=' <i class="fa fa-plus" aria-hidden="true">'
        var item = searchResults[itemID];
        for(var i = 0; i < queue.length; i++) {
            if (queue[i].etag == item.etag) {
                var classAdd = "searchedResults";
                var plusButtonValue = "";
                break;
            }
        }
        search_results.innerHTML += searchResultTemplate.supplant({ classSong: classAdd,
                                                                    videoID: item.id.videoId,
                                                                   title: item.snippet.title,
                                                                   plusButton: plusButtonValue,
                                                                   thumbnailURL: item.snippet.thumbnails.high.url,
                                                               });
    }
}


function playthisNow(pos){
    console.log("hey");
        var pos = parseInt(pos);
        var element=queue[pos];
        queue.splice(pos, 1);
        queue.unshift(element);
        refreshQueue();
        nextVideo();
}


function refreshQueue() {
    saveUserPlaylist();
    //here save online
    var FIRST_ENTRY_TEMPLATE = '<tr>\
                                    <td><a onclick="playthisNow(\'{pos}\')" title="Play Now">\
                                        {title}\
                                        </a>\
                                    </td>\
                                    <td>\
                                        <a onclick="remove_onClick(\'{pos}\')" title="Remove from queue">\
                                       <i class="fa fa-times" aria-hidden="true"></i>\
                                    </a>\
                                    </td>\
                                    <td><a onclick="next_onClick()"> <i class="fa fa-play" aria-hidden="true"></i> <a></td>\
                                    <td></td>\
                                    </tr>';
    var CONSEQ_ENTRY_TEMPLATE = '<tr>\
    <td><a onclick="playthisNow(\'{pos}\')" title="Play Now">\
        {title}\
        </a>\
    </td>\
                                    <td>\
                                        <a onclick="remove_onClick(\'{pos}\')" title="Remove from queue">\
                                            <i class="fa fa-times" aria-hidden="true"></i>\
                                       </a>\
                                    </td>\
                                    <td>\
                                        <a onclick="upward_onClick(\'{pos}\')" title="Move upwards in queue">\
                                            <i class="fa fa-chevron-up" aria-hidden="true"></i>\
                                       </a>\
                                    </td>\
                                    <td></td>\
                                    </tr>';

    var queue_list = document.getElementById("queue");

    // delete all the entries
    while (queue_list.lastChild) {
        queue_list.removeChild(queue_list.lastChild);
    }

    // create the first entry
    if (queue.length) {
        queue_list.innerHTML = FIRST_ENTRY_TEMPLATE.supplant({title: queue[0].snippet.title,
                                                              thumbnailURL: queue[0].snippet.thumbnails.high.url,
                                                              pos: 0});
    }

    // create rest of the entries
    for (var i=1; i < queue.length; ++i) {
        queue_list.innerHTML += CONSEQ_ENTRY_TEMPLATE.supplant({title: queue[i].snippet.title,
                                                                pos: i,
                                                                isDisabled: i == queue.length - 1 ? "disabled" : ""});
    }
}


function changeVideo(videoID) {
    window.location.hash = videoID;
}

/* ==================================================== CALLBACKS =================================================== */
window.onhashchange = function() {
    var videoID = window.location.hash.slice(1, 1 + 11);
    if (videoID.length == 11) {
        loadVideo(videoID);
    }
}

function header_title_onClick() {
    document.getElementsByTagName("main")[0].scrollTop = 0;
}


function video_title_onClick(videoID) {
    exitSearch();
    changeVideo(videoID);
}


function add_onClick(id) {
    showPlaylist();
    queue.unshift(searchResults[id]);
    refreshQueue();
    refreshSearchResults();
    if(queue.length==1){
        nextVideo()
    }
}

function queue_thumbnail_onClick() {
    nextVideo();
}

function queue_title_onClick() {
    nextVideo();
}

function thumbnail_onClick(videoID) {
    exitSearch();
    changeVideo(videoID);
}



function main_onScroll(main) {
    if (state === "searching" && main.scrollTop + main.clientHeight + SCROLL_TRIGGER >= main.scrollHeight)
        search(true, true);
}

function search_onInput(input_e) {
    if (input_e.value.length === 0) {
        exitSearch();
    }
    else {
        enterSearch();

        var date = new Date();
        lastKeystroke = date.getTime();

        setTimeout(search, SEARCH_DELAY);
    }
}


function search_onKeydown(event) {
    if (event.keyCode == 13) {  // if enter is pressed
        enterSearch();
        search(true);
    }
}

function search_onClick(search_i) {
    if (search_i.value.length) {
        enterSearch();

        if (Object.keys(searchResults).length)
            refreshSearchResults();
        else
            search(true);
    }
}


function slider_onChange(slider) {
    player.seekTo(slider.value, true);
}


function slider_onMousedown() {
    sliderInUse = true;
}


function slider_onMouseup() {
    sliderInUse = false;
}


function remove_onClick(pos) {
    queue.splice(pos, 1);
    refreshQueue();
    refreshSearchResults();

}


function upward_onClick(pos) {
    pos = parseInt(pos);
    queue.splice(pos - 1, 0, queue.splice(pos, 1)[0]);
    refreshQueue();
}


function downward_onClick(pos) {
    pos = parseInt(pos);
    queue.splice(pos + 1, 0, queue.splice(pos, 1)[0]);
    refreshQueue();
}


function playPause_onClick() {
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    }
    else {
        player.playVideo();
    }
}


function volume_onClick(pp_btn) {
    if (player.isMuted()) {
        pp_btn.innerHTML = '<i class="fa fa-volume-up" aria-hidden="true"></i>';
        player.unMute();
    }
    else {
        player.mute();
        pp_btn.innerHTML = '<i class="fa fa-volume-off" aria-hidden="true"></i>';
    }
}

function video_onStateChange() {
    var pp_btn = document.getElementById("play-pause");

    if (player.getPlayerState() === YT.PlayerState.ENDED) {

            pp_btn.innerHTML = '<i class="fa fa-play playpause" aria-hidden="true"></i>';
            nextVideo();

    }
    else if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        pp_btn.innerHTML = '<i class="fa fa-pause playpause" aria-hidden="true"></i>';
    }
    else {
        pp_btn.innerHTML = '<i class="fa fa-play playpause" aria-hidden="true"></i>';
    }
}


function video_onReady(event) {
    event.target.playVideo();
    event.target.unMute();
    event.target.setVolume(100);

}

function next_onClick() {
    nextVideo();
}

/* ==================================================== UTILITIES =================================================== */
// http://javascript.crockford.com/remedial.html
if (!String.prototype.supplant) {
    String.prototype.supplant = function (o) {
        return this.replace(
            /\{([^{}]*)\}/g,
            function (a, b) {
                var r = o[b];
                return typeof r === 'string' || typeof r === 'number' ? r : a;
            }
        );
    };
}

// http://stackoverflow.com/a/25209563
function parseDuration(duration) {
    var matches = duration.match(/[0-9]+[HMS]/g);

    var seconds = 0;

    matches.forEach(function (part) {
        var unit = part.charAt(part.length-1);
        var amount = parseInt(part.slice(0,-1));

        switch (unit) {
            case 'H':
                seconds += amount * 60 * 60;
                break;
            case 'M':
                seconds += amount * 60;
                break;
            case 'S':
                seconds += amount;
                break;
            default:
        }
    });

    return seconds;
}


function hidePlaylist(){
    console.log("hiding");
    document.getElementById("searchZone").style.width="80%"
    document.getElementById("playlistZone").style.display="none"

}

function showPlaylist(){
    document.getElementById("searchZone").style.width="30.666667%"
    document.getElementById("playlistZone").style.display="inline"


}
