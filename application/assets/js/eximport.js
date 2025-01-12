import { list_files } from "./helper.js";
import { toaster } from "./helper.js";
import { side_toaster } from "./helper.js";
import { sort_array } from "./helper.js";

import localforage from "localforage";
import { events } from "../../app.js";

import ICAL from "ical.js";

const dayjs = require("dayjs");
var moment = require("moment-timezone");

export let export_ical = function (filename, event_data) {
  if (!navigator.getDeviceStorage) return false;

  var sdcard = navigator.getDeviceStorage("sdcard");

  var request_del = sdcard.delete(filename);
  request_del.onsuccess = function () {};
  setTimeout(function () {
    let result = "";

    result += "BEGIN:VCALENDAR" + "\r\n";
    result += "VERSION:2.0" + "\r\n";
    result += "PRODID:GREG" + "\r\n";
    result += "METHOD:PUBLISHED" + "\r\n";

    event_data.forEach((e, i) => {
      let index = -1;
      for (let key in e) {
        index++;

        //clean data
        if (e[key] == null || typeof e[key] == "object")
          event_data.splice(i, 1);

        if (index == 0) result += "BEGIN:VEVENT" + "\r\n";

        if (
          key != "BEGIN" &&
          key != "END" &&
          key != "date" &&
          key != "time_start" &&
          key != "time_end" &&
          key != "dateStart" &&
          key != "dateEnd" &&
          key != "alarm" &&
          key != "isSubscription" &&
          key != "multidayevent" &&
          key != "alarmTrigger" &&
          key != "rrule_" &&
          key != "isCalDav" &&
          key != "id" &&
          key != "allDay" &&
          key != "isCaldav" &&
          key != "tzid" &&
          key != "rrule_json" &&
          key != "etag" &&
          key != "url" &&
          key != "id" &&
          key != "dateStartUnix" &&
          key != "dateEndUnix"
        ) {
          result += `${key}:${e[key]}` + "\r\n";
        }
        if (index == Object.keys(e).length - 1) result += "END:VEVENT" + "\r\n";
      }
    });

    result += "END:VCALENDAR" + "\r\n";

    result = result.replace(/:;TZID/g, ";TZID");
    //remove empty lines
    let regex = /^\s*$(?:\r\n?|\n)/gm;
    result = result.replace(regex, "");

    var file = new Blob([result], { type: "text/calendar" });
    var request = sdcard.addNamed(file, filename);
    request.onsuccess = function () {
      side_toaster("<img src='assets/image/E25C.svg'>", 2500);
    };

    request.onerror = function () {
      toaster("Unable to write the file", 2000);
    };
  }, 2000);
};

////////////
///LIST ICS
//////////////

export let list_ics = function () {
  let file_list = [];
  let cb = function (result) {
    file_list.push(result);

    let fn = result.split("/");
    fn = fn[fn.length - 1];
    if (fn == "greg.ics") return false;

    document.querySelector("div#options div#import-text").style.display =
      "block";

    document
      .querySelector("div#options div#import-text")
      .insertAdjacentHTML(
        "afterend",
        '<button class="item dynamic" data-function="import" data-filename="' +
          result +
          '">' +
          fn +
          "</button>"
      );
  };

  list_files("ics", cb);
};

// /////////////
// /PARSE ICS
// /////////////

export let parse_ics = function (
  data,
  callback,
  isSubscription,
  etag,
  url,
  account_id,
  isCaldav
) {
  var jcalData = ICAL.parse(data);

  var comp = new ICAL.Component(jcalData);
  var vevent = comp.getAllSubcomponents("vevent");
  vevent.forEach(function (ite) {
    let n = "";

    let rrule_freq = "none";
    if (
      typeof ite.getFirstPropertyValue("rrule") == "object" &&
      ite.getFirstPropertyValue("rrule") != null &&
      ite.getFirstPropertyValue("rrule").freq != null
    ) {
      n = ite.getFirstPropertyValue("rrule");
      rrule_freq = n.freq;
    }

    let dateStart, timeStart, dateStartUnix;
    if (ite.getFirstPropertyValue("dtstart")) {
      dateStart = dayjs(ite.getFirstPropertyValue("dtstart")).format(
        "YYYY-MM-DD"
      );
      timeStart = dayjs(ite.getFirstPropertyValue("dtstart")).format(
        "HH:mm:ss"
      );
      dateStartUnix =
        new Date(ite.getFirstPropertyValue("dtstart")).getTime() / 1000;
    }

    //date end
    let dateEnd, timeEnd, dateEndUnix;
    if (ite.getFirstPropertyValue("dtend")) {
      dateEnd = dayjs(ite.getFirstPropertyValue("dtend")).format("YYYY-MM-DD");
      timeEnd = dayjs(ite.getFirstPropertyValue("dtend")).format("HH:mm:ss");
      dateEndUnix =
        new Date(ite.getFirstPropertyValue("dtend")).getTime() / 1000;
    }

    //allDay event
    let allday = false;

    if (
      ite.getFirstPropertyValue("dtend") &&
      ite.getFirstPropertyValue("dtstart")
    ) {
      if (timeStart == timeEnd) {
        allday = true;
      }
    }

    let lastmod = ite.getFirstPropertyValue("last-modified");

    let dtstart = ite.getFirstPropertyValue("dtstart");
    let dtend = ite.getFirstPropertyValue("dtend");

    if (account_id == "local-id") {
      dtstart =
        ";TZID=" +
        ite.getFirstPropertyValue("dtstart").timezone +
        ":" +
        ite.getFirstPropertyValue("dtstart").toICALString();

      dtend =
        ";TZID=" +
        ite.getFirstPropertyValue("dtend").timezone +
        ":" +
        ite.getFirstPropertyValue("dtend").toICALString();

      lastmod =
        ";TZID=" +
        ite.getFirstPropertyValue("last-modified").timezone +
        ":" +
        ite.getFirstPropertyValue("last-modified").toICALString();
    }

    let imp = {
      BEGIN: "VEVENT",
      UID: ite.getFirstPropertyValue("uid"),
      SUMMARY: ite.getFirstPropertyValue("summary"),
      LOCATION: ite.getFirstPropertyValue("location"),
      DESCRIPTION: ite.getFirstPropertyValue("description"),
      ATTACH: ite.getFirstPropertyValue("attach"),
      RRULE: ite.getFirstPropertyValue("rrule"),
      "LAST-MODIFIED": lastmod,
      CLASS: ite.getFirstPropertyValue("class"),
      DTSTAMP: dtstart,
      DTSTART: dtstart,
      DTEND: dtend,
      END: "VEVENT",
      tzid: ite.getFirstPropertyValue("dtstart").timezone,
      isSubscription: isSubscription,
      isCaldav: isCaldav,
      allDay: allday,
      dateStart: dateStart,
      time_start: timeStart,
      dateStartUnix: dateStartUnix,
      dateEnd: dateEnd,
      time_end: timeEnd,
      dateEndUnix: dateEndUnix,
      alarm: "none",
      rrule_: rrule_freq,
      rrule_json: n,

      etag: etag,
      url: url,
      id: account_id,
    };

    events.push(imp);
  });
  sort_array(events, "dateStartUnix", "date");
};

/////////////
///FETCH ICS
///////////

export let fetch_ics = function (url, cb, db_name) {
  let xhttp = new XMLHttpRequest({ mozSystem: true });

  xhttp.open("GET", url + "?time=" + new Date().getTime(), true);
  xhttp.timeout = 2000;

  xhttp.onprogress = function () {
    // toaster("loading subscriptions", 2000);
  };

  xhttp.onload = function () {
    if (xhttp.readyState === xhttp.DONE && xhttp.status === 200) {
      let data = xhttp.response;

      parse_ics(data, cb, false, true);

      localforage
        .setItem(db_name, data)
        .then(function () {})
        .catch(function (err) {
          console.log(err);
        });
      side_toaster("subscriptions loaded", 2000);
    }
  };

  xhttp.onerror = function () {
    side_toaster("subscription could not be loaded", 2000);

    localforage
      .getItem(db_name)
      .then(function (value) {
        toaster("load cached data", 2000);
        parse_ics(value, cb);
      })
      .catch(function (err) {
        console.log(err);
      });
  };

  xhttp.send(null);
};

function share(url, name) {
  var activity = new MozActivity({
    name: "share",
    data: {
      type: "text/calendar",
      number: 1,
      blobs: [url],
      filenames: [name],
    },
  });

  activity.onsuccess = function () {};
  activity.onerror = function () {};
}

// ///////////////////////
// ///Load ICS///////////
// /////////////////////

export function loadICS(filename, callback) {
  var sdcard = navigator.getDeviceStorage("sdcard");

  var request = sdcard.get(filename);

  request.onsuccess = function () {
    var file = this.result;

    let reader = new FileReader();

    reader.onerror = function (event) {
      toaster("can't read file", 3000);
      reader.abort();
    };

    reader.onloadend = function (event) {
      parse_ics(event.target.result, callback, true, false);
      document.getElementById("import-text").style.display = "block";
    };

    reader.readAsText(file);
  };

  request.onerror = function () {
    console.warn("Unable to get the file: " + this.error);
  };
}
