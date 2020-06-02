import * as yargs from "yargs";
import * as Fuse from "fuse-native";
import { Learn2018Helper } from "thu-learn-lib";
import { stat } from "./helpers";

const argv = yargs
  .scriptName("learnfs")
  .usage("$0 [mountpoint] -u [username] -p [password]")
  .alias("u", "username")
  .alias("p", "password")
  .string("u")
  .string("p")
  .demandOption(["u", "p"])
  .demandCommand(1).argv;

async function main() {
  const helper = new Learn2018Helper();
  await helper.login(argv.u, argv.p);
  let courses = [];
  let notifications = {}; // course.name -> notification
  let discussions = {}; // course.name -> discussion

  const ops = {
    readdir: async (path, cb) => {
      const semester = await helper.getCurrentSemester();
      courses = await helper.getCourseList(semester.id);
      if (path === "/")
        return cb(
          null,
          courses.map((course) => {
            return course.name;
          })
        );
      else if (
        courses.filter((course) => path === `/${course.name}`).length > 0
      ) {
        console.log("getcourse:", path);
        return cb(null, ["notification", "discussion"]);
      } else if (path.endsWith("notification")) {
        console.log("getnotification:", path);
        let course = courses.filter(
          (course) => path === `/${course.name}/notification`
        )[0];
        console.log("course=", course);
        const res = await helper.getNotificationList(
          course.id,
          course.courseType
        );
        console.log("res=", res);
        notifications[course.name] = res;
        return cb(
          null,
          res.map((notification) => notification.title)
        );
      } else if (path.endsWith("discussion")) {
        console.log("getdiscussion:", path);
        let course = courses.filter(
          (course) => path === `/${course.name}/discussion`
        )[0];
        console.log("course=", course);
        const res = await helper.getDiscussionList(
          course.id,
          course.courseType
        );
        console.log("res=", res);
        return cb(
          null,
          res.map((discussion) => discussion.title)
        );
      }
      return cb(Fuse.ENOENT);
    },
    getattr: function (path: string, cb) {
      if (path === "/")
        return process.nextTick(cb, null, stat({ mode: "dir", size: 4096 }));
      else if (courses.find((course) => course.name === path.substring(1)))
        return process.nextTick(cb, null, stat({ mode: "dir", size: 4096 }));
      else {
        let paths = path.substring(1).split("/");
        console.log("paths=", paths);
        if (courses.find((course) => course.name === paths[0])) {
          if (paths.length === 2) {
            if (paths[1] === "notification") {
              return process.nextTick(
                cb,
                null,
                stat({ mode: "dir", size: 4096 })
              );
            } else if (paths[1] === "discussion") {
              return process.nextTick(
                cb,
                null,
                stat({ mode: "dir", size: 4096 })
              );
            }
          } else if (paths.length === 3) {
            // TODO: check title validity
            if (paths[1] === "notification") {
              return process.nextTick(
                cb,
                null,
                stat({ mode: "file", size: 1000 }) //TODO: get file size
              );
            }
          }
        }
      }
      return process.nextTick(cb, Fuse.ENOENT);
    },
    open: function (path, flags, cb) {
      return cb(0, 42);
    },
    release: function (path, fd, cb) {
      return cb(0);
    },
    read: function (path, fd, buf, len, pos, cb) {
      // Read notification
      let paths = path.substring(1).split("/");
      if (courses.find((course) => course.name === paths[0])) {
        // get one notifcation
        if (paths.length === 3 && paths[1] === "notification") {
          let title = paths[2];
          console.log("notifications=", notifications[paths[0]]);
          let notification = notifications[paths[0]].filter(
            (item) => item.title === title
          );
          if (notification.length === 1) {
            notification = notification[0];
            let str = JSON.stringify(notification, null, 2);
            console.log("str=", str.length, str);
            buf.write(str);
            return cb(str.length);
          } else {
            return cb(0);
          }
        }
      }
    },
  };

  const fuse = new Fuse(argv._[0], ops, { debug: false });
  fuse.mount((err) => {
    console.error(err);
  });
  process.once("SIGINT", function () {
    fuse.unmount((err) => {
      if (err) {
        console.error(err);
      } else {
        console.log("unmounted success");
      }
    });
  });
}

main().catch((err) => console.error(err));
