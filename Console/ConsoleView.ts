import Console from "./ConsoleService";
import bb from "../bb";

const { ccclass, property } = cc._decorator;
@ccclass
export default class ConsoleView extends cc.Component {
    @property(cc.EditBox)
    inputCmd: cc.EditBox = null;

    start() {
        Console.init();
    };

    onClickRun() {
        bb.notify(`执行GM${this.inputCmd.string}`);
        Console.runCmd(this.inputCmd.string);
    };
};
