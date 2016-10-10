/**
 * @file 测试 runner
 *
 * @description
 *     跑测试前，启动 selenium-standalone start
 *
 * @example
 *
 * 点击:
 *     WDBridge.send('action', 'click:#' + myComponent.id);
 * 输入:
 *     WDBridge.send('action', 'addValue:#' + input.id + '|added1');
 */

var path = require('path');
var httpServer = require('http-server');
var webdriverio = require('webdriverio');

// start server
var server = httpServer.createServer({
    root: path.resolve(__dirname, '../../')
}).listen(8001);

process.on('exit', function() {
    server && server.close();
});

process.on('uncaughtException', function (err) {
    console.log(err);
    process.exit(1);
});

// config webdriverio

// saucelabs
var devices = require('./devices');

// standalone
// var devices = {
//     chrome: {
//         desiredCapabilities: {
//             browserName: 'chrome'
//         }
//     }
// };

// devices var
var devicesList = Object.keys(devices);
var devicesAll = devicesList.length;
var devicesDone = 0;

function processEnd (code) {

    if (code == 0) {

        // 完美结束
        if (++devicesDone == devicesAll) {
            setTimeout(function () {
                process.exit(code);
            }, 200);
        }

        return;
    }

    setTimeout(function () {
        process.exit(code);
    }, 200);
}

function processStart (device) {

    var client = webdriverio.remote(device);

    // report result
    var reportResultRegEx = /^\d+ specs, (\d+) failure/;
    var reportResult;

    /**
     * 桥循环
     *
     * @param  {number} timeout    超时时间
     * @param  {string} timeoutMsg 超时信息
     * @param  {number} interval   循环间隔
     * @return {client}            webdrive client
     */
    function bridgeLoop(timeout, timeoutMsg, interval) {

        interval = interval || 100;
        timeoutMsg = timeoutMsg || '这个测试超时了';

        return client
            // .timeoutsAsyncScript(10)
            .executeAsync(function(done) {

                // 浏览器端 接口
                window.WDBridge.nextTick(done);

            }).then(function(ret) {

                var msg = ret.value.message;

                // 获取结果
                var match = reportResultRegEx.exec(msg);
                if (match) {
                    reportResult = match[1] === '0' ? 0 : 1;
                }

                // 正常结束
                if (/^Finished/.test(msg)) {
                    console.log(msg);
                    client.end();
                    processEnd(reportResult);
                    return;
                }

                // 超时
                if ((timeout -= interval) < 0) {
                    console.log(timeoutMsg);
                    client.end();
                    processEnd(1);
                    return;
                }

                // 正常 log
                if (msg) {
                    process.stdout.write(msg);
                }

                // 正常 action
                var action = ret.value.action;

                if (action) {
                    var act = action.split(':');
                    var actName = act[0].trim();
                    var actParams = act[1].trim().split('|');
                    client[actName].apply(client, actParams);
                }

                // 等下一个天亮
                setTimeout(function() {

                    bridgeLoop(timeout, timeoutMsg, interval);

                }, interval);

            });

    }

    client.addCommand('bridgeLoop', bridgeLoop);

    client
        .init()
        .url('http://127.0.0.1:8001/test/')
        .bridgeLoop(1000 * 60 * 5);

}

// run
devicesList.forEach(function (key) {
    processStart(devices[key]);
});
