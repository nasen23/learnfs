import * as yargs from "yargs";
import * as Fuse from "fuse-native";

const argv = yargs
  .scriptName("learnfs")
  .usage("$0 [mountpoint] -u [username] -p [password]")
  .alias("u", "username")
  .alias("p", "password")
  .demandOption(["u", "p"])
  .demandCommand(1).argv;

console.log(argv);
