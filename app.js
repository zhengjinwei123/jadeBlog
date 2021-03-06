/**
 * Created by zhengjinwei on 2016/12/19.
 */
var JadeLoader = require("./mnode/app").plugin.JadeLoader;
var Path = require("path");
var Singleton = require("./mnode/app").utils.Singleton;
var Logger = Singleton.getInstance(require("./mnode/app").utils.Logger, Path.join(__dirname, "./web/config/logger.json"), Path.join(__dirname, "./logs"));

JadeLoader.init(Path.join(__dirname, "./"), true, 360, function () {
    Logger.info("jadeLoader", "jade Loader Finished");

    JadeLoader.set('logger', Logger);//将logger保存
    JadeLoader.set('settings', require("./web/config/settings"));
    JadeLoader.set("advertCnt", require("./web/utils/common").getAdvertsCnt());
    JadeLoader.set("func_setbar", require("./web/utils/common").setBar);

    //启用mongoose
    var settings = JadeLoader.get('settings');
    var MongooseManager = JadeLoader.Jader('utils').getInstance('db-mongodb', settings.db.mongodb.host, settings.db.mongodb.port, settings.db.mongodb.db, settings.db.mongodb.auth, Path.join(__dirname, "./web/schemas"));
    JadeLoader.set("m", MongooseManager);
    MongooseManager.on("error", function (error) {
        Logger.error("blog", "mongoose error" + error);
    });
    MongooseManager.on("connect", function (options) {
        if (settings.user.use) {
            JadeLoader.get("func_setbar")(settings.user.username, function () {
                Logger.debug("blog","加载 sidebar 完成");
            });
        }
        Logger.debug("blog", "success conncted to " + options.host + " on port " + options.port);
        JadeLoader.set('mainpage', settings.mainPage);
    });


    var Express = JadeLoader.Jader('plugin').getInstance('express', '127.0.0.1', 8085, Path.join(__dirname, "./web"));

    //定义过滤器中间件，消息先在这里进行过滤，然后进用户
    Express.use(function (req, res, next) {
        var url = req.originalUrl;
        req.dispatch = function (render, data, func) {
            req.template = {
                render: render,
                data: data
            };
            func();
        };
        req.json = function (data) {
            res.end(JSON.stringify(data));
        };
        function getReqUrl(url) {
            var t = url.split("?");
            return t[0];
        }

        url = getReqUrl(url);
        console.error(url)
        if (!Express.routesList[url]) {
            if(req.method.toLowerCase() == 'post'){
                res.json({error:"路由非法"});
            }else{
                res.redirect("/index");
            }
        } else {
            var warnUrls = ["/blog/editblog", "/blog/addNew","/blog/editblog/deleteBlog","/blog/editblog/addNewType"];
            if (warnUrls.indexOf(url) != -1) {
                if (req.session && req.session.user) {
                    next();
                } else {
                    if(url.indexOf("lib") != -1){
                        next();
                    }else{
                        if(req.method.toLowerCase() == 'post'){
                            res.json({error:"无权限"});
                        }else{
                            res.redirect("/index");
                        }
                    }
                }
            } else {
                next();
            }
        }
    });

    //判断是否已经登录
    function isLogin(req) {
        return req.session && req.session.user;
    }

    //判断是否加载侧边栏数据
    function isLoadSideBar(req) {
        if (isLogin(req)) {
            return true;
        } else if (JadeLoader.get("settings").user.use) {
            return true;
        } else {
            return false;
        }
    }

    //定义消息派递中间件
    Express.dispatch(function (req, res, next) {
        if (req.template && req.template.data && req.template.render) {
            if (isLogin(req)) {
                req.template.data.userName = req.session.user;
            } else {
                req.template.data.userName = '';
            }

            req.template.data.lang = req.session.lang || 'ch';

            req.template.data.projectName = (req.template.data.lang == 'ch') ? '郑金玮的博客' : "Jade's Blog";
            req.template.data.dateTime = new Date().getFullYear();
            req.template.data.sidebar = isLoadSideBar(req) ? JadeLoader.get('sidebar') : [];
            req.template.data.advertcnt = JadeLoader.get('advertCnt');
            req.template.data.title = (req.template.data.lang == 'ch') ? '郑金玮的博客' : "Jade's Blog";
            (req.template.render == 'index') && (req.template.data.mainpage = JadeLoader.get('mainpage'));
            res.render(req.template.render, req.template.data);
        } else {
            next("<h6>invalid request</h6>");
        }
    });

    //启动express
    Express.start(function () {
        Logger.debug('blog', "express already listen on port 8085");
    });

    //拦截异常
    Express.on('uncaughtException', function (err) {
        console.error('blog', 'Got uncaughtException', err.stack, err);
        if (d.env() == 'development') {
            process.exit(1);
        }
    });
});

//监听热加载器的error事件
JadeLoader.on("error", function (err) {
    Logger.error('jadeLoader', err);
});
//监听热加载器的定时加载事件
JadeLoader.on("hotLoad", function (resp) {
    Logger.debug('jadeLoader', resp);
});
