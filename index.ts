import * as yargs from "yargs";
import * as Fuse from "fuse-native";
import { Learn2018Helper } from 'thu-learn-lib';
import { stat } from './helpers';

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

  const ops = {
    readdir: async (path, cb) => {
      const semester = await helper.getCurrentSemester();
      courses = await helper.getCourseList(semester.id);
      if (path === '/')
        return cb(null, courses.map(course => {
          return course.name;
        }));
      return cb(Fuse.ENOENT);
    },
    getattr: function (path: string, cb) {
      if (path === '/')
          return process.nextTick(cb, null, stat({ mode: 'dir', size: 4096 }))
      else if (courses.find(course => course.name === path.substring(1)))
        return process.nextTick(cb, null, stat({ mode: 'dir', size: 4096 }))
      return process.nextTick(cb, Fuse.ENOENT)
    },
    open: function (path, flags, cb) {
      return cb(0, 42)
    },
    release: function (path, fd, cb) {
      return cb(0)
    },
    read: function (path, fd, buf, len, pos, cb) {
      var str = 'hello world'.slice(pos, pos + len)
      if (!str) return cb(0)
      buf.write(str)
      return cb(str.length)
    }
  };

  const fuse = new Fuse(argv._[0], ops, { debug: false });
  fuse.mount(err => {
    console.error(err);
  });
};

main().catch(err => console.error(err));
