import * as yargs from 'yargs';
import * as Fuse from 'fuse-native';
import { Learn2018Helper } from 'thu-learn-lib';
import { stat, directory, Category } from './helpers';

const argv = yargs
  .scriptName('learnfs')
  .usage('$0 [mountpoint] -u [username] -p [password]')
  .alias('u', 'username')
  .alias('p', 'password')
  .string('u')
  .string('p')
  .demandOption(['u', 'p'])
  .demandCommand(1).argv;

async function main() {
  const helper = new Learn2018Helper();
  await helper.login(argv.u, argv.p);

  let courses = [];
  let notifications = {}; // course.name -> notification
  let discussions = {}; // course.name -> discussion
  let files = {};
  let homework = {};

  const ops = {
    init: async cb => {
      const semester = await helper.getCurrentSemester();
      courses = await helper.getCourseList(semester.id);
      cb(0);
    },
    readdir: async (path, cb) => {
      if (path === '/')
        return cb(
          null,
          courses.map(course => {
            return course.name;
          })
        );
      const slices = path.split('/').filter(x => x);
      if (slices.length > 0) {
        const course = courses.find(course => course.name === slices[0]);
        if (!course) return cb(Fuse.ENOENT);
        if (slices.length == 1)
          return cb(null, directory(Object.values(Category)));
        else {
          const category = slices[1] as Category;
          if (!category) return cb(Fuse.ENOENT);
          if (category == Category.notification) {
            const res = await helper.getNotificationList(
              course.id,
              course.courseType
            );
            notifications[course.name] = res;
            if (slices.length == 2) {
              return cb(
                null,
                res.map(notification => notification.title)
              );
            } else {
            }
          } else if (category == Category.file) {
            const res = await helper.getFileList(course.id);
            files[course.name] = res;
            if (slices.length == 2) {
              return cb(null, directory([]));
            } else {
            }
          } else if (category == Category.discussion) {
            const res = await helper.getDiscussionList(
              course.id,
              course.courseType
            );
            discussions[course.name] = res;
            if (slices.length == 2) {
              return cb(
                null,
                res.map(discussion => discussion.title)
              );
            } else {
            }
          } else {
          }
        }
      }
      return cb(Fuse.ENOENT);
    },
    getattr: function (path: string, cb) {
      if (path === '/') return cb(null, stat({ mode: 'dir', size: 4096 }));
      const slices = path.split('/').filter(x => x);
      if (slices.length > 0) {
        const course = courses.find(course => course.name === slices[0]);
        if (!course) return cb(Fuse.ENOENT);
        if (slices.length == 1)
          return cb(null, stat({ mode: 'dir', size: '4096' }));
        else {
          const category: Category | undefined = slices[1] as Category;
          if (!category) return cb(Fuse.ENOENT);
          if (slices.length == 2) {
            return cb(null, stat({ mode: 'dir', size: 4096 }));
          } else {
            // TODO: switch (category)
          }
        }
      }
      return cb(Fuse.ENOENT);
    },
    open: function (path, flags, cb) {
      return cb(0, 42);
    },
    release: function (path, fd, cb) {
      return cb(0);
    },
    read: function (path, fd, buf, len, pos, cb) {
      // Read notification
      let paths = path.substring(1).split('/');
      if (courses.find(course => course.name === paths[0])) {
        // get one notifcation
        if (paths.length === 3 && paths[1] === 'notification') {
          let title = paths[2];
          let notification = notifications[paths[0]].filter(
            item => item.title === title
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
  fuse.mount(err => {
    console.error(err);
  });
  process.once('SIGINT', function () {
    fuse.unmount(err => {
      if (err) {
        console.error(err);
      } else {
        console.log('unmounted success');
      }
    });
  });
}

main().catch(err => console.error(err));
