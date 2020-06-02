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
            try {
              // TODO: switch (category)
              if (slices.length == 3 && slices[1] === Category.notification) {
                const size = Buffer.from(
                  JSON.stringify(
                    notifications[slices[0]].filter(
                      nf => nf.title === slices[2]
                    )[0]
                  )
                ).length;
                return cb(null, stat({ mode: 'file', size }));
              } else if (
                slices.length == 3 &&
                slices[1] === Category.discussion
              ) {
                const size = Buffer.from(
                  JSON.stringify(
                    discussions[slices[0]].filter(
                      dc => dc.title === slices[2]
                    )[0]
                  )
                ).length;
                return cb(null, stat({ mode: 'file', size }));
              }
            } catch (err) {
              return cb(Fuse.ENOENT);
            }
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
        try {
          if (paths.length === 3 && paths[1] === Category.notification) {
            // Read one notification
            let notification = notifications[paths[0]].filter(
              item => item.title === paths[2]
            )[0];
            let str = JSON.stringify(notification);
            let tmp = Buffer.from(str);
            tmp.copy(buf);
            return cb(tmp.length);
          } else if (paths.length === 3 && paths[1] === Category.discussion) {
            // Read discussion
            let discussion = discussions[paths[0]].filter(
              item => item.title === paths[2]
            )[0];
            let str = JSON.stringify(discussion, null, 2);
            let tmp = Buffer.from(str);
            tmp.copy(buf);
            return cb(tmp.length);
          }
        } catch (err) {
          return cb(0);
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
