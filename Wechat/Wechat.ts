import { HttpRequest } from "../Network/Http"
import bb from "../bb";
import { isTTGame, isWXGame } from "../Utils";

const isWechat = isWXGame() || isTTGame();

export enum Gender {
	UNKNOW,
	MALE,
	FEMALE,
}

export const TTAppName: any = {
	TOU_TIAO: 'Toutiao', // 今日头条
	DOU_YIN: 'Douyin', // 抖音短视屏
	XI_GUA: 'XiGua', // 西瓜视频
	NEWS: 'news_article_lite', // 头条极速版
	DEV: 'devtools', // 开发环境
}

export interface UserInfo {
	nickName: string;
	avatarUrl: string;
	gender: Gender, //性别 0：未知、1：男、2：女
	province: string,
	city: string,
	country: string,
}

export interface AppMessage {
	title?: string;
	imageUrl?: string;
	query?: string;
	imageUrlId?: string;
	toCurrentGroup?: boolean;
}

export interface LaunchOptions {
	scene: number;
	query: any;
	referrerInfo: any;
	shareTicket?: string; // 仅适合微信
	path?: string; // 仅适合头条
}

class Wechat {
	userInfo: UserInfo;
	appId: string;
	openId: string;
	unionId: string;
	sessionKey: string;
	iv: string;
	videoPath: string;

	EventType = {
		RECORD_START: "RECORD_START",
		RECORD_STOP: "RECORD_STOP",
	}

	init(appId: string) {
		if (!isWechat) {
			return;
		}
		this.appId = appId;
		let recorder = wx.getGameRecorderManager();
		recorder.onStart(() => {
			console.log("record start");
			bb.dispatch(this.EventType.RECORD_START);
		});
		recorder.onStop((res) => {
			console.log("record stop", res);
			this.videoPath = res.videoPath
			bb.dispatch(this.EventType.RECORD_STOP, res.videoPath);
		})
	}

	async getUserInfo(askPrefab?: cc.Prefab) {
		return new Promise<UserInfo>((resolve) => {
			if (this.userInfo) {
				resolve(this.userInfo);
				return;
			}
			if (isTTGame()) {
				// 头条直接请求
				wx.getUserInfo({
					success: (res) => {
						var userInfo = res.userInfo
						this.userInfo = {
							nickName: userInfo.nickName,
							avatarUrl: userInfo.avatarUrl,
							gender: userInfo.gender,
							province: userInfo.province,
							city: userInfo.city,
							country: userInfo.country,
						};
						resolve(this.userInfo);
					}
				});
				return;
			}
			wx.getSetting({
				success: (res) => {
					console.log(res.authSetting)
					if (res.authSetting["scope.userInfo"]) {
						wx.getUserInfo({
							success: (res) => {
								var userInfo = res.userInfo
								this.userInfo = {
									nickName: userInfo.nickName,
									avatarUrl: userInfo.avatarUrl,
									gender: userInfo.gender,
									province: userInfo.province,
									city: userInfo.city,
									country: userInfo.country,
								};
								resolve(this.userInfo);
							}
						})
					} else {
						let systemInfo = wx.getSystemInfoSync();
						let width = systemInfo.windowWidth;
						let height = systemInfo.windowHeight;
						let button = wx.createUserInfoButton({
							type: 'text',
							text: '',
							style: {
								left: 0,
								top: 0,
								width: width,
								height: height,
								lineHeight: 40,
								backgroundColor: '#00000000',
								color: '#00000000',
								textAlign: 'center',
								fontSize: 10,
								borderRadius: 4
							}
						});

						var askNode: cc.Node;
						if (askPrefab) {
							askNode = cc.instantiate(askPrefab);
							const canvas = cc.find('Canvas');
							canvas.addChild(askNode);
						}

						console.log("wx button", button);

						button.onTap((res) => {
							if (askNode) {
								askNode.removeFromParent();
							}
							let userInfo = res.userInfo;
							if (!userInfo) {
								console.log(res.errMsg);
								button.hide();
								button.destroy();
								resolve();
								return;
							}
							this.userInfo = res.userInfo;
							button.hide();
							button.destroy();
							resolve(this.userInfo);
						});
					}
				}
			})
		});
	}

	initUserInfoButton(success?: any) {
		let systemInfo = wx.getSystemInfoSync();
		let width = systemInfo.windowWidth;
		let height = systemInfo.windowHeight;
		let button = wx.createUserInfoButton({
			type: 'text',
			text: '',
			style: {
				left: 0,
				top: 0,
				width: width,
				height: height,
				lineHeight: 40,
				backgroundColor: '#00000000',
				color: '#00000000',
				textAlign: 'center',
				fontSize: 10,
				borderRadius: 4
			}
		});

		button.onTap((res) => {
			let userInfo = res.userInfo;
			if (!userInfo) {
				console.log(res.errMsg);
				return;
			}
			this.userInfo = res.userInfo;
			button.hide();
			button.destroy();
			if (success) {
				success(this.userInfo);
			}
		});
	}

	submitScore(key: string, score: number) {
		wx.setUserCloudStorage({
			KVDataList: [{ key, value: String(score) }],
			success: (ret) => {
				console.log("setUserCloudStore ok", ret);
			},
			fail: (ret) => {
				console.log("setUserCloudStorage fail", ret);
			},
			complete: (ret) => {
				console.log("setUserCloudStore complete", ret);
			}
		});
		cc.sys.localStorage.setItem(key, score);
	}

	getMyScore(key: string, cb: any) {
		var localScore = parseInt(cc.sys.localStorage.getItem(key)) || 0;
		return localScore;
	}

	submitRank(score: number) {
		wx.setUserCloudStorage({
			wxgame: {
				score,
				update_time: Date.parse(Date()) / 1000
			}
		})
	}

	postMessageOpenContent(cmd, data) {
		wx.getOpenDataContext().postMessage({
			cmd,
			data,
		});
	}

	async asyncHttpGet(req: HttpRequest) {
		return new Promise<any>((resolve, reject) => {
			wx.request({
				url: req.url,
				method: "GET",
				header: { Authorization: req.authorization },
				data: req.data,
				success: (res) => {
					resolve(res.data);
				},
				fail: () => {
					reject(`get error, url:${req.url}`);
				}
			})
		});
	}
	async asyncHttpPost(req: HttpRequest) {
		console.log("wechat post", req);
		return new Promise<any>((resolve, reject) => {
			wx.request({
				url: req.url,
				method: "POST",
				header: { Authorization: req.authorization },
				data: req.data,
				success: (res) => {
					resolve(res.data);
				},
				fail: () => {
					reject(`post error, url:${req.url}`);
				}
			})
		});
	}

	httpGet(req: HttpRequest) {
		wx.request({
			url: req.url,
			method: "GET",
			header: { Authorization: req.authorization },
			data: req.data,
			success: (res) => {
				req.success && req.success(res.data);
			},
			fail: req.fail,
		})
	}
	httpPost(req: HttpRequest) {
		wx.request({
			url: req.url,
			method: "POST",
			header: { Authorization: req.authorization },
			data: req.data,
			success: (res) => {
				req.success && req.success(res.data);
			},
			fail: req.fail,
		})
	}

	startRecord(duration: number) {
		if (isWechat) {
			let recorder = wx.getGameRecorderManager();
			recorder.start({ duration });
		}
	}

	stopRecord() {
		if (isWechat) {
			let recorder = wx.getGameRecorderManager();
			recorder.stop();
		}
	}

	async shareVideo(title: string, desc: string) {
		if (isWechat) {
			return new Promise<any>((resolve, reject) => {
				console.log("share", this.videoPath);
				wx.shareAppMessage({
					channel: 'video',
					title,
					desc,
					extra: {
						videoPath: this.videoPath
					},
					success: () => {
						console.log('分享视频成功');
						resolve(true);
					},
					fail: (e) => {
						console.log('分享视频失败', e);
						resolve(false);
					}
				});
			});
		}
	}

	getTTAppname() {
		if (isTTGame()) {
			return wx.getSystemInfoSync().appName;
		}
	}

	shareAppMessage(msg: AppMessage) {
		if (isWechat) {
			wx.shareAppMessage(msg);
		}
	}

	getLaunchOptionsSync(): LaunchOptions {
		return wx.getLaunchOptionsSync()
	}

	onShow(callback: (LaunchOptions)) {
		wx.onShow(callback)
	}

}

export default new Wechat();