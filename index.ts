import * as yargs from 'yargs';
import * as Fuse from 'fuse-native';
import * as crossFetch from 'cross-fetch';
import * as stream from 'stream';
import { Response } from 'node-fetch';
import { Learn2018Helper } from 'thu-learn-lib';
import { CourseInfo, File } from 'thu-learn-lib/lib/types';
import { stat, directory, Category } from './helpers';
const realIsomorphicFetch = require('real-isomorphic-fetch');

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

  let semesters: string[] = [];
  let courses: { [key: string]: CourseInfo[] } = {};
  let notifications = {}; // course.name -> notification
  let discussions = {}; // course.name -> discussion
  let files = {};
  let homework = {};
  let fds = {};
  let current = 0;

  const ops = {
    init: async cb => {
      semesters = await helper.getSemesterIdList();
      cb(0);
    },
    readdir: async (path, cb) => {
      if (path === '/')
        return cb(
          null,
          semesters
        );
      const slices = path.split('/').filter(x => x);
      if (slices.length > 0) {
        const semester = slices[0] as string;
        if (!semesters.includes(semester))
          return cb(Fuse.ENOENT);
        courses[semester] = await helper.getCourseList(semester);
        if (slices.length === 1) {
          return cb(null, directory(
            courses[semester].map(course => {
              return course.name;
            })));
        }
        const course = courses[semester]?.find(course => course.name === slices[1]);

        if (!course) return cb(Fuse.ENOENT);
        if (slices.length == 2)
          return cb(null, directory(Object.values(Category)));
        else {
          const category = slices[2] as Category;
          if (!category) return cb(Fuse.ENOENT);
          if (category == Category.notification) {
            const res = await helper.getNotificationList(
              course.id,
              course.courseType
            );
            notifications[course.name] = res;
            if (slices.length == 3) {
              return cb(
                null,
                res.map(notification => notification.title)
              );
            } else {
            }
          } else if (category == Category.file) {
            const res = await helper.getFileList(course.id);
            files[course.name] = res;
            if (slices.length == 3) {
              return cb(
                null,
                directory(
                  files[course.name].map(
                    file => `${file.title}.${file.fileType}`
                  )
                )
              );
            }
          } else if (category == Category.discussion) {
            const res = await helper.getDiscussionList(
              course.id,
              course.courseType
            );
            discussions[course.name] = res;
            if (slices.length == 3) {
              return cb(
                null,
                res.map(discussion => discussion.title)
              );
            } else {
            }
          } else {
            const res = await helper.getHomeworkList(
              course.id,
              course.courseType
            );
            homework[course.name] = res;
            if (slices.length === 3) {
              return cb(
                null,
                res.map(homework => homework.title)
              );
            }
            // const title = slices[3]
            // const work = homework[course.name].find(work => work.title === title);
            // if (!work) return cb(Fuse.ENOENT);
          }
        }
      }
      return cb(Fuse.ENOENT);
    },
    getattr: function (path: string, cb) {
      if (path === '/') return cb(null, stat({ mode: 'dir', size: 4096 }));
      const slices = path.split('/').filter(x => x);
      if (slices.length > 0) {
        const semester = slices[0] as string;
        if (!semesters.includes(semester))
          return cb(Fuse.ENOENT);
        if (slices.length === 1)
          return cb(null, stat({ mode: 'dir', size: '4096' }));

        const course = courses[semester]?.find(course => course.name === slices[1]);
        if (!course) return cb(Fuse.ENOENT);
        if (slices.length == 2)
          return cb(null, stat({ mode: 'dir', size: '4096' }));
        else {
          const category = slices[2] as Category;
          if (!category) return cb(Fuse.ENOENT);
          if (slices.length == 3) {
            return cb(null, stat({ mode: 'dir', size: 4096 }));
          } else {
            try {
              // TODO: switch (category)
              if (slices.length == 4 && slices[2] === Category.notification) {
                const size = Buffer.from(
                  JSON.stringify(
                    notifications[slices[1]].filter(
                      nf => nf.title === slices[3]
                    )[0]
                  )
                ).length;
                return cb(null, stat({ mode: 'file', size }));
              } else if (
                slices.length == 4 &&
                slices[2] === Category.discussion
              ) {
                const size = Buffer.from(
                  JSON.stringify(
                    discussions[slices[1]].filter(
                      dc => dc.title === slices[3]
                    )[0]
                  )
                ).length;
                return cb(null, stat({ mode: 'file', size }));
              } else if (category === Category.file) {
                const fileName = slices[3];
                const file = files[course.name].find(
                  file => `${file.title}.${file.fileType}` === fileName
                );
                if (!file) return cb(Fuse.ENOENT);
                if (slices.length === 4) {
                  return cb(null, stat({ mode: 'file', size: file.rawSize }));
                }
              } else {
                const title = slices[3];
                const work = homework[course.name].find(
                  work => work.title === title
                );
                if (!work) return cb(Fuse.ENOENT);
                if (slices.length === 4) {
                  return cb(null, stat({ mode: 'dir', size: 4096 }));
                }
              }
            } catch (err) {
              return cb(Fuse.ENOENT);
            }
          }
        }
      }
      return cb(Fuse.ENOENT);
    },
    open: async function (path: string, flags, cb) {
      // match a file
      const slices = path.split('/').filter(x => x);
      if (slices.length !== 4) {
        return cb(Fuse.ENOENT);
      }
      const semester = slices[0];
      const course = courses[semester]?.find(course => course.name === slices[1]);
      if (!course) return cb(Fuse.ENOENT);
      const file = files[course.name].find(
        file => `${file.title}.${file.fileType}` === slices[3]
      );
      if (!file) return cb(Fuse.ENOENT);
      const fetch = new realIsomorphicFetch(crossFetch, helper.cookieJar);
      const response: Response = await fetch(file.downloadUrl);
      fds[current++] = await response.buffer();
      return cb(0, current - 1);
    },
    release: function (path, fd, cb) {
      delete fds[fd];
      return cb(0);
    },
    read: async function (path, fd, buf, len, pos, cb) {
      // Read notification
      let paths = path.substring(1).split('/');
      const semester = paths[0];
      if (courses[semester]?.find(course => course.name === paths[1])) {
        try {
          if (paths.length === 4 && paths[2] === Category.notification) {
            // Read one notification
            let notification = notifications[paths[1]].filter(
              item => item.title === paths[3]
            )[0];
            let str = JSON.stringify(notification);
            let tmp = Buffer.from(str);
            tmp.copy(buf);
            return cb(tmp.length);
          } else if (paths.length === 4 && paths[2] === Category.discussion) {
            // Read discussion
            let discussion = discussions[paths[1]].filter(
              item => item.title === paths[3]
            )[0];
            let str = JSON.stringify(discussion);
            let tmp = Buffer.from(str);
            tmp.copy(buf);
            return cb(tmp.length);
          } else if (paths.length === 4 && paths[2] === Category.file) {
            const fileName = paths[3];
            const file = files[paths[1]].find(
              file => `${file.title}.${file.fileType}` === fileName
            );
            if (!file) return cb(Fuse.ENOENT);
            const stream = fds[fd];
            if (!stream) return cb(Fuse.ENOENT);
            const slice = stream.slice(pos, pos + len);
            if (slice.length === 0) {
              return cb(0);
            }
            slice.copy(buf);
            return cb(slice.length);
          }
        } catch (err) {
          return cb(0);
        }
      }
    },
  };

  const fuse = new Fuse(argv._[0], ops, { debug: true });
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
