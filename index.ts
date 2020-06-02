<<<<<<< HEAD
import * as yargs from "yargs";
import * as Fuse from "fuse-native";
import { Learn2018Helper } from "thu-learn-lib";
import { stat } from "./helpers";
=======
import * as yargs from 'yargs';
import * as Fuse from 'fuse-native';
import { Learn2018Helper } from 'thu-learn-lib';
import { stat, directory, Category } from './helpers';
>>>>>>> 2b221f53b3b19fb31ca510a35e8479a58b0d1999

const argv = yargs
  .scriptName('learnfs')
  .usage('$0 [mountpoint] -u [username] -p [password]')
  .alias('u', 'username')
  .alias('p', 'password')
  .string('u')
  .string('p')
  .demandOption(['u', 'p'])
  .demandCommand(1).argv;

let courses;

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
        return cb(null, ["notification", "discussion"]);
      } else if (path.endsWith("notification")) {
        let course = courses.filter(
          (course) => path === `/${course.name}/notification`
        )[0];
        const res = await helper.getNotificationList(
          course.id,
          course.courseType
        );
        notifications[course.name] = res;
        return cb(
          null,
          res.map((notification) => notification.title)
        );
      } else if (path.endsWith("discussion")) {
        let course = courses.filter(
          (course) => path === `/${course.name}/discussion`
        )[0];
        const res = await helper.getDiscussionList(
          course.id,
          course.courseType
        );
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
          let notification = notifications[paths[0]].filter(
            (item) => item.title === title
          );
          if (notification.length === 1) {
            notification = notification[0];
            let str = JSON.stringify(notification, null, 2);
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
