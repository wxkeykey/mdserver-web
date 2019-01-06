function str2Obj(str){
    var data = {};
    kv = str.split('&');
    for(i in kv){
        v = kv[i].split('=');
        data[v[0]] = v[1];
    }
    return data;
}

function myPost(method,args,callback){

    var _args = null; 
    if (typeof(args) == 'string'){
        _args = JSON.stringify(str2Obj(args));
    } else {
        _args = JSON.stringify(args);
    }

    var loadT = layer.msg('正在获取...', { icon: 16, time: 0, shade: 0.3 });
    $.post('/plugins/run', {name:'mysql', func:method, args:_args}, function(data) {
        layer.close(loadT);
        if (!data.status){
            layer.msg(data.msg,{icon:0,time:2000,shade: [0.3, '#000']});
            return;
        }

        if(typeof(callback) == 'function'){
            callback(data);
        }
    },'json'); 
}

function runInfo(){
    myPost('run_info','',function(data){

        var rdata = $.parseJSON(data.data);
        if (typeof(rdata['status']) != 'undefined'){
            layer.msg(rdata['msg'],{icon:0,time:2000,shade: [0.3, '#000']});
            return;
        }

        var cache_size = ((parseInt(rdata.Qcache_hits) / (parseInt(rdata.Qcache_hits) + parseInt(rdata.Qcache_inserts))) * 100).toFixed(2) + '%';
        if (cache_size == 'NaN%') cache_size = 'OFF';
        var Con = '<div class="divtable"><table class="table table-hover table-bordered" style="margin-bottom:10px;background-color:#fafafa">\
                    <tbody>\
                        <tr><th>启动时间</th><td>' + getLocalTime(rdata.Run) + '</td><th>每秒查询</th><td>' + parseInt(rdata.Questions / rdata.Uptime) + '</td></tr>\
                        <tr><th>总连接次数</th><td>' + rdata.Connections + '</td><th>每秒事务</th><td>' + parseInt((parseInt(rdata.Com_commit) + parseInt(rdata.Com_rollback)) / rdata.Uptime) + '</td></tr>\
                        <tr><th>发送</th><td>' + toSize(rdata.Bytes_sent) + '</td><th>File</th><td>' + rdata.File + '</td></tr>\
                        <tr><th>接收</th><td>' + toSize(rdata.Bytes_received) + '</td><th>Position</th><td>' + rdata.Position + '</td></tr>\
                    </tbody>\
                    </table>\
                    <table class="table table-hover table-bordered">\
                    <thead style="display:none;"><th></th><th></th><th></th><th></th></thead>\
                    <tbody>\
                        <tr><th>活动/峰值连接数</th><td>' + rdata.Threads_running + '/' + rdata.Max_used_connections + '</td><td colspan="2">若值过大,增加max_connections</td></tr>\
                        <tr><th>线程缓存命中率</th><td>' + ((1 - rdata.Threads_created / rdata.Connections) * 100).toFixed(2) + '%</td><td colspan="2">若过低,增加thread_cache_size</td></tr>\
                        <tr><th>索引命中率</th><td>' + ((1 - rdata.Key_reads / rdata.Key_read_requests) * 100).toFixed(2) + '%</td><td colspan="2">若过低,增加key_buffer_size</td></tr>\
                        <tr><th>Innodb索引命中率</th><td>' + ((1 - rdata.Innodb_buffer_pool_reads / rdata.Innodb_buffer_pool_read_requests) * 100).toFixed(2) + '%</td><td colspan="2">若过低,增加innodb_buffer_pool_size</td></tr>\
                        <tr><th>查询缓存命中率</th><td>' + cache_size + '</td><td colspan="2">' + lan.soft.mysql_status_ps5 + '</td></tr>\
                        <tr><th>创建临时表到磁盘</th><td>' + ((rdata.Created_tmp_disk_tables / rdata.Created_tmp_tables) * 100).toFixed(2) + '%</td><td colspan="2">若过大,尝试增加tmp_table_size</td></tr>\
                        <tr><th>已打开的表</th><td>' + rdata.Open_tables + '</td><td colspan="2">若过大,增加table_cache_size</td></tr>\
                        <tr><th>没有使用索引的量</th><td>' + rdata.Select_full_join + '</td><td colspan="2">若不为0,请检查数据表的索引是否合理</td></tr>\
                        <tr><th>没有索引的JOIN量</th><td>' + rdata.Select_range_check + '</td><td colspan="2">若不为0,请检查数据表的索引是否合理</td></tr>\
                        <tr><th>排序后的合并次数</th><td>' + rdata.Sort_merge_passes + '</td><td colspan="2">若值过大,增加sort_buffer_size</td></tr>\
                        <tr><th>锁表次数</th><td>' + rdata.Table_locks_waited + '</td><td colspan="2">若值过大,请考虑增加您的数据库性能</td></tr>\
                    <tbody>\
            </table></div>'
        $(".soft-man-con").html(Con);
    });
}


function myPort(){
    myPost('my_port','',function(data){
        var con = '<div class="line ">\
            <div class="info-r  ml0">\
            <input name="port" class="bt-input-text mr5 port" type="text" style="width:100px" value="'+data.data+'">\
            <button id="btn_change_port" name="btn_change_port" class="btn btn-success btn-sm mr5 ml5 btn_change_port">修改</button>\
            </div></div>';
        $(".soft-man-con").html(con);

        $('#btn_change_port').click(function(){
            var port = $("input[name='port']").val();
            myPost('set_my_port','port='+port,function(data){
                var rdata = $.parseJSON(data.data);
                if (rdata.status){
                    layer.msg('修改成功!',{icon:1,time:2000,shade: [0.3, '#000']});
                } else {
                    layer.msg(rdata.msg,{icon:1,time:2000,shade: [0.3, '#000']});
                }
            });
        });
    });
}

function dbList(){
    var con = '<div class="safe bgw">\
            <button onclick="database.add_database()" title="添加数据库" class="btn btn-success btn-sm" type="button" style="margin-right: 5px;">添加数据库</button>\
            <button onclick="bt.database.set_root()" title="设置MySQL管理员密码" class="btn btn-default btn-sm" type="button" style="margin-right: 5px;">root密码</button>\
            <button onclick="bt.database.open_phpmyadmin(\'\',\'root\',\'bce2de353cba1ce2\')" title="打开phpMyadmin" class="btn btn-default btn-sm" type="button" style="margin-right: 5px;">phpMyAdmin</button>\
            <span style="float:right">              \
                <button batch="true" style="float: right;display: none;margin-left:10px;" onclick="database.batch_database(\'del\');" title="删除选中项" class="btn btn-default btn-sm">删除选中</button>\
                <button onclick="bt.recycle_bin.open_recycle_bin(6)" id="dataRecycle" title="删除选中项" class="btn btn-default btn-sm" style="margin-left: 5px;"><span class="glyphicon glyphicon-trash" style="margin-right: 5px;"></span>回收站</button>\
            </span>\
            <div class="divtable mtb10">\
                <div class="tablescroll">\
                    <table id="DataBody" class="table table-hover" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 0 none;">\
                    <thead><tr><th width="30"><input class="check" onclick="bt.check_select();" type="checkbox"></th>\
                    <th>数据库名</th>\
                    <th>用户名</th>\
                    <th>密码</th>\
                    <th>备份</th><th>备注</th>\
                    <th style="text-align:right;">操作</th></tr></thead>\
                    <tbody>\
                    </tbody></table>\
                </div>\
                 <div id="databasePage" class="dataTables_paginate paging_bootstrap page"><div><span class="Pcurrent">1</span><span class="Pcount">共2条数据</span></div></div>\
                <div class="table_toolbar">\
                    <span class="sync btn btn-default btn-sm" style="margin-right:5px" onclick="database.sync_to_database(1)" title="将选中数据库信息同步到服务器">同步选中</span>\
                    <span class="sync btn btn-default btn-sm" style="margin-right:5px" onclick="database.sync_to_database(0)" title="将所有数据库信息同步到服务器">同步所有</span>\
                    <span class="sync btn btn-default btn-sm" onclick="database.sync_database()" title="从服务器获取数据库列表">从服务器获取</span>\
                </div>\
            </div>\
        </div>';

    $(".soft-man-con").html(con);
}

//设置二进制日志
function SetBinLog() {
    var loadT = layer.msg(lan.public.the, { icon: 16, time: 0, shade: 0.3 });
    $.post('/database?action=BinLog', "", function(rdata) {
        layer.close(loadT);
        layer.msg(rdata.msg, { icon: rdata.status ? 1 : 5 });
        mysqlLog();
    });
}

//清空日志
function closeMySqlLog() {
    var loadT = layer.msg(lan.public.the, { icon: 16, time: 0, shade: 0.3 });
    $.post('/database?action=GetErrorLog', "close=1", function(rdata) {
        layer.close(loadT);
        layer.msg(rdata.msg, { icon: rdata.status ? 1 : 5 });
        mysqlLog();
    });
}





//数据库存储信置
function changeMySQLDataPath(act) {
    if (act != undefined) {
        layer.confirm(lan.soft.mysql_to_msg, { closeBtn: 2, icon: 3 }, function() {
            var datadir = $("#datadir").val();
            var data = 'datadir=' + datadir;
            var loadT = layer.msg(lan.soft.mysql_to_msg1, { icon: 16, time: 0, shade: [0.3, '#000'] });
            $.post('/database?action=SetDataDir', data, function(rdata) {
                layer.close(loadT)
                layer.msg(rdata.msg, { icon: rdata.status ? 1 : 5 });
            });
        });
        return;
    }

    $.post('/database?action=GetMySQLInfo', '', function(rdata) {
        var LimitCon = '<p class="conf_p">\
                            <input id="datadir" class="phpUploadLimit bt-input-text mr5" style="width:350px;" type="text" value="' + rdata.datadir + '" name="datadir">\
                            <span onclick="ChangePath(\'datadir\')" class="glyphicon glyphicon-folder-open cursor mr20" style="width:auto"></span><button class="btn btn-success btn-sm" onclick="changeMySQLDataPath(1)">' + lan.soft.mysql_to + '</button>\
                        </p>';
        $(".soft-man-con").html(LimitCon);
    });
}



//数据库日志
function mysqlLog(act) {
    //获取二进制日志相关信息
    $.post('/database?action=BinLog', "status=1", function(rdata) {
        var limitCon = '<p class="conf_p">\
                            <span class="f14 c6 mr20">' + lan.soft.mysql_log_bin + ' </span><span class="f14 c6 mr20">' + ToSize(rdata.msg) + '</span>\
                            <button class="btn btn-success btn-xs va0" onclick="SetBinLog();">' + (rdata.status ? lan.soft.off : lan.soft.on) + '</button>\
                            <p class="f14 c6 mtb10" style="border-top:#ddd 1px solid; padding:10px 0">' + lan.soft.mysql_log_err + '<button class="btn btn-default btn-xs" style="float:right;" onclick="closeMySqlLog();">' + lan.soft.mysql_log_close + '</button></p>\
                            <textarea readonly style="margin: 0px;width: 515px;height: 440px;background-color: #333;color:#fff; padding:0 5px" id="error_log"></textarea>\
                        </p>'

        $(".soft-man-con").html(limitCon);

        //获取错误日志
        $.post('/database?action=GetErrorLog', "", function(error_body) {
            if (error_body.status === false) {
                layer.msg(error_body.msg, { icon: 5 });
                error_body = lan.soft.mysql_log_ps1;
            }
            if (error_body == "") error_body = lan.soft.mysql_log_ps1;
            $("#error_log").text(error_body);
            var ob = document.getElementById('error_log');
            ob.scrollTop = ob.scrollHeight;
        });
    });
}


//数据库配置状态
function myPerfOpt() {
    //获取MySQL配置
    myPost('db_status','',function(data){
        var rdata = $.parseJSON(data.data);
        console.log(rdata);

        var key_buffer_size = toSizeM(rdata.mem.key_buffer_size);
        var query_cache_size = toSizeM(rdata.mem.query_cache_size);
        var tmp_table_size = toSizeM(rdata.mem.tmp_table_size);
        var innodb_buffer_pool_size = toSizeM(rdata.mem.innodb_buffer_pool_size);
        var innodb_additional_mem_pool_size = toSizeM(rdata.mem.innodb_additional_mem_pool_size);
        var innodb_log_buffer_size = toSizeM(rdata.mem.innodb_log_buffer_size);

        var sort_buffer_size = toSizeM(rdata.mem.sort_buffer_size);
        var read_buffer_size = toSizeM(rdata.mem.read_buffer_size);
        var read_rnd_buffer_size = toSizeM(rdata.mem.read_rnd_buffer_size);
        var join_buffer_size = toSizeM(rdata.mem.join_buffer_size);
        var thread_stack = toSizeM(rdata.mem.thread_stack);
        var binlog_cache_size = toSizeM(rdata.mem.binlog_cache_size);

        var a = key_buffer_size + query_cache_size + tmp_table_size + innodb_buffer_pool_size + innodb_additional_mem_pool_size + innodb_log_buffer_size;
        var b = sort_buffer_size + read_buffer_size + read_rnd_buffer_size + join_buffer_size + thread_stack + binlog_cache_size;
        var memSize = a + rdata.mem.max_connections * b;


        var memCon = '<div class="conf_p" style="margin-bottom:0">\
                        <div style="border-bottom:#ccc 1px solid;padding-bottom:10px;margin-bottom:10px"><span><b>最大使用内存: </b></span>\
                        <select class="bt-input-text" name="mysql_set" style="margin-left:-4px">\
                            <option value="0">请选择</option>\
                            <option value="1">1-2GB</option>\
                            <option value="2">2-4GB</option>\
                            <option value="3">4-8GB</option>\
                            <option value="4">8-16GB</option>\
                            <option value="5">16-32GB</option>\
                        </select>\
                        <span>' + lan.soft.mysql_set_maxmem + ': </span><input style="width:70px;background-color:#eee;" class="bt-input-text mr5" name="memSize" type="text" value="' + memSize.toFixed(2) + '" readonly>MB\
                        </div>\
                        <p><span>key_buffer_size</span><input style="width: 70px;" class="bt-input-text mr5" name="key_buffer_size" value="' + key_buffer_size + '" type="number" >MB, <font>' + lan.soft.mysql_set_key_buffer_size + '</font></p>\
                        <p><span>query_cache_size</span><input style="width: 70px;" class="bt-input-text mr5" name="query_cache_size" value="' + query_cache_size + '" type="number" >MB, <font>' + lan.soft.mysql_set_query_cache_size + '</font></p>\
                        <p><span>tmp_table_size</span><input style="width: 70px;" class="bt-input-text mr5" name="tmp_table_size" value="' + tmp_table_size + '" type="number" >MB, <font>' + lan.soft.mysql_set_tmp_table_size + '</font></p>\
                        <p><span>innodb_buffer_pool_size</span><input style="width: 70px;" class="bt-input-text mr5" name="innodb_buffer_pool_size" value="' + innodb_buffer_pool_size + '" type="number" >MB, <font>' + lan.soft.mysql_set_innodb_buffer_pool_size + '</font></p>\
                        <p><span>innodb_log_buffer_size</span><input style="width: 70px;" class="bt-input-text mr5" name="innodb_log_buffer_size" value="' + innodb_log_buffer_size + '" type="number">MB, <font>' + lan.soft.mysql_set_innodb_log_buffer_size + '</font></p>\
                        <p style="display:none;"><span>innodb_additional_mem_pool_size</span><input style="width: 70px;" class="bt-input-text mr5" name="innodb_additional_mem_pool_size" value="' + innodb_additional_mem_pool_size + '" type="number" >MB</p>\
                        <p><span>sort_buffer_size</span><input style="width: 70px;" class="bt-input-text mr5" name="sort_buffer_size" value="' + (sort_buffer_size * 1024) + '" type="number" >KB * ' + lan.soft.mysql_set_conn + ', <font>' + lan.soft.mysql_set_sort_buffer_size + '</font></p>\
                        <p><span>read_buffer_size</span><input style="width: 70px;" class="bt-input-text mr5" name="read_buffer_size" value="' + (read_buffer_size * 1024) + '" type="number" >KB * ' + lan.soft.mysql_set_conn + ', <font>' + lan.soft.mysql_set_read_buffer_size + ' </font></p>\
                        <p><span>read_rnd_buffer_size</span><input style="width: 70px;" class="bt-input-text mr5" name="read_rnd_buffer_size" value="' + (read_rnd_buffer_size * 1024) + '" type="number" >KB * ' + lan.soft.mysql_set_conn + ', <font>' + lan.soft.mysql_set_read_rnd_buffer_size + ' </font></p>\
                        <p><span>join_buffer_size</span><input style="width: 70px;" class="bt-input-text mr5" name="join_buffer_size" value="' + (join_buffer_size * 1024) + '" type="number" >KB * ' + lan.soft.mysql_set_conn + ', <font>' + lan.soft.mysql_set_join_buffer_size + '</font></p>\
                        <p><span>thread_stack</span><input style="width: 70px;" class="bt-input-text mr5" name="thread_stack" value="' + (thread_stack * 1024) + '" type="number" >KB * ' + lan.soft.mysql_set_conn + ', <font>' + lan.soft.mysql_set_thread_stack + '</font></p>\
                        <p><span>binlog_cache_size</span><input style="width: 70px;" class="bt-input-text mr5" name="binlog_cache_size" value="' + (binlog_cache_size * 1024) + '" type="number" >KB * ' + lan.soft.mysql_set_conn + ', <font>' + lan.soft.mysql_set_binlog_cache_size + '</font></p>\
                        <p><span>thread_cache_size</span><input style="width: 70px;" class="bt-input-text mr5" name="thread_cache_size" value="' + rdata.mem.thread_cache_size + '" type="number" ><font> ' + lan.soft.mysql_set_thread_cache_size + '</font></p>\
                        <p><span>table_open_cache</span><input style="width: 70px;" class="bt-input-text mr5" name="table_open_cache" value="' + rdata.mem.table_open_cache + '" type="number" > <font>' + lan.soft.mysql_set_table_open_cache + '</font></p>\
                        <p><span>max_connections</span><input style="width: 70px;" class="bt-input-text mr5" name="max_connections" value="' + rdata.mem.max_connections + '" type="number" ><font> ' + lan.soft.mysql_set_max_connections + '</font></p>\
                        <div style="margin-top:10px; padding-right:15px" class="text-right"><button class="btn btn-success btn-sm mr5" onclick="reBootMySqld()">重启数据库</button><button class="btn btn-success btn-sm" onclick="setMySQLConf()">保存</button></div>\
                    </div>'

        $(".soft-man-con").html(memCon);

        $(".conf_p input[name*='size'],.conf_p input[name='max_connections'],.conf_p input[name='thread_stack']").change(function() {
            comMySqlMem();
        });

        $(".conf_p select[name='mysql_set']").change(function() {
            mySQLMemOpt($(this).val());
            comMySqlMem();
        });
    });
}

function reBootMySqld(){
    pluginOpService('mysql','restart','');
}


//设置MySQL配置参数
function setMySQLConf() {
    $.post('/system/system_total', '', function(memInfo) {
        var memSize = memInfo['memTotal'];
        var setSize = parseInt($("input[name='memSize']").val());
        
        if(memSize < setSize){
            var errMsg = "错误,内存分配过高!<p style='color:red;'>物理内存: {1}MB<br>最大使用内存: {2}MB<br>可能造成的后果: 导致数据库不稳定,甚至无法启动MySQLd服务!";
            var msg = errMsg.replace('{1}',memSize).replace('{2}',setSize);
            layer.msg(msg,{icon:2,time:5000});
            return;
        }

        var query_cache_size = parseInt($("input[name='query_cache_size']").val());
        var query_cache_type = 0;
        if (query_cache_size > 0) {
            query_cache_type = 1;
        }
        var data = {
            key_buffer_size: parseInt($("input[name='key_buffer_size']").val()),
            query_cache_size: query_cache_size,
            query_cache_type: query_cache_type,
            tmp_table_size: parseInt($("input[name='tmp_table_size']").val()),
            max_heap_table_size: parseInt($("input[name='tmp_table_size']").val()),
            innodb_buffer_pool_size: parseInt($("input[name='innodb_buffer_pool_size']").val()),
            innodb_log_buffer_size: parseInt($("input[name='innodb_log_buffer_size']").val()),
            sort_buffer_size: parseInt($("input[name='sort_buffer_size']").val()),
            read_buffer_size: parseInt($("input[name='read_buffer_size']").val()),
            read_rnd_buffer_size: parseInt($("input[name='read_rnd_buffer_size']").val()),
            join_buffer_size: parseInt($("input[name='join_buffer_size']").val()),
            thread_stack: parseInt($("input[name='thread_stack']").val()),
            binlog_cache_size: parseInt($("input[name='binlog_cache_size']").val()),
            thread_cache_size: parseInt($("input[name='thread_cache_size']").val()),
            table_open_cache: parseInt($("input[name='table_open_cache']").val()),
            max_connections: parseInt($("input[name='max_connections']").val())
        };

        myPost('set_db_status', data, function(data){
            var rdata = $.parseJSON(data.data);
            showMsg(rdata.msg,function(){
                reBootMySqld();
            },{ icon: rdata.status ? 1 : 2 });
        });
    },'json');
}


//MySQL内存优化方案
function mySQLMemOpt(opt) {
    var query_size = parseInt($("input[name='query_cache_size']").val());
    switch (opt) {
        case '0':
            $("input[name='key_buffer_size']").val(8);
            if (query_size) $("input[name='query_cache_size']").val(4);
            $("input[name='tmp_table_size']").val(8);
            $("input[name='innodb_buffer_pool_size']").val(16);
            $("input[name='sort_buffer_size']").val(256);
            $("input[name='read_buffer_size']").val(256);
            $("input[name='read_rnd_buffer_size']").val(128);
            $("input[name='join_buffer_size']").val(128);
            $("input[name='thread_stack']").val(256);
            $("input[name='binlog_cache_size']").val(32);
            $("input[name='thread_cache_size']").val(4);
            $("input[name='table_open_cache']").val(32);
            $("input[name='max_connections']").val(500);
            break;
        case '1':
            $("input[name='key_buffer_size']").val(128);
            if (query_size) $("input[name='query_cache_size']").val(64);
            $("input[name='tmp_table_size']").val(64);
            $("input[name='innodb_buffer_pool_size']").val(256);
            $("input[name='sort_buffer_size']").val(768);
            $("input[name='read_buffer_size']").val(768);
            $("input[name='read_rnd_buffer_size']").val(512);
            $("input[name='join_buffer_size']").val(1024);
            $("input[name='thread_stack']").val(256);
            $("input[name='binlog_cache_size']").val(64);
            $("input[name='thread_cache_size']").val(64);
            $("input[name='table_open_cache']").val(128);
            $("input[name='max_connections']").val(100);
            break;
        case '2':
            $("input[name='key_buffer_size']").val(256);
            if (query_size) $("input[name='query_cache_size']").val(128);
            $("input[name='tmp_table_size']").val(384);
            $("input[name='innodb_buffer_pool_size']").val(384);
            $("input[name='sort_buffer_size']").val(768);
            $("input[name='read_buffer_size']").val(768);
            $("input[name='read_rnd_buffer_size']").val(512);
            $("input[name='join_buffer_size']").val(2048);
            $("input[name='thread_stack']").val(256);
            $("input[name='binlog_cache_size']").val(64);
            $("input[name='thread_cache_size']").val(96);
            $("input[name='table_open_cache']").val(192);
            $("input[name='max_connections']").val(200);
            break;
        case '3':
            $("input[name='key_buffer_size']").val(384);
            if (query_size) $("input[name='query_cache_size']").val(192);
            $("input[name='tmp_table_size']").val(512);
            $("input[name='innodb_buffer_pool_size']").val(512);
            $("input[name='sort_buffer_size']").val(1024);
            $("input[name='read_buffer_size']").val(1024);
            $("input[name='read_rnd_buffer_size']").val(768);
            $("input[name='join_buffer_size']").val(2048);
            $("input[name='thread_stack']").val(256);
            $("input[name='binlog_cache_size']").val(128);
            $("input[name='thread_cache_size']").val(128);
            $("input[name='table_open_cache']").val(384);
            $("input[name='max_connections']").val(300);
            break;
        case '4':
            $("input[name='key_buffer_size']").val(512);
            if (query_size) $("input[name='query_cache_size']").val(256);
            $("input[name='tmp_table_size']").val(1024);
            $("input[name='innodb_buffer_pool_size']").val(1024);
            $("input[name='sort_buffer_size']").val(2048);
            $("input[name='read_buffer_size']").val(2048);
            $("input[name='read_rnd_buffer_size']").val(1024);
            $("input[name='join_buffer_size']").val(4096);
            $("input[name='thread_stack']").val(384);
            $("input[name='binlog_cache_size']").val(192);
            $("input[name='thread_cache_size']").val(192);
            $("input[name='table_open_cache']").val(1024);
            $("input[name='max_connections']").val(400);
            break;
        case '5':
            $("input[name='key_buffer_size']").val(1024);
            if (query_size) $("input[name='query_cache_size']").val(384);
            $("input[name='tmp_table_size']").val(2048);
            $("input[name='innodb_buffer_pool_size']").val(4096);
            $("input[name='sort_buffer_size']").val(4096);
            $("input[name='read_buffer_size']").val(4096);
            $("input[name='read_rnd_buffer_size']").val(2048);
            $("input[name='join_buffer_size']").val(8192);
            $("input[name='thread_stack']").val(512);
            $("input[name='binlog_cache_size']").val(256);
            $("input[name='thread_cache_size']").val(256);
            $("input[name='table_open_cache']").val(2048);
            $("input[name='max_connections']").val(500);
            break;
    }
}

//计算MySQL内存开销
function comMySqlMem() {
    var key_buffer_size = parseInt($("input[name='key_buffer_size']").val());
    var query_cache_size = parseInt($("input[name='query_cache_size']").val());
    var tmp_table_size = parseInt($("input[name='tmp_table_size']").val());
    var innodb_buffer_pool_size = parseInt($("input[name='innodb_buffer_pool_size']").val());
    var innodb_additional_mem_pool_size = parseInt($("input[name='innodb_additional_mem_pool_size']").val());
    var innodb_log_buffer_size = parseInt($("input[name='innodb_log_buffer_size']").val());

    var sort_buffer_size = $("input[name='sort_buffer_size']").val() / 1024;
    var read_buffer_size = $("input[name='read_buffer_size']").val() / 1024;
    var read_rnd_buffer_size = $("input[name='read_rnd_buffer_size']").val() / 1024;
    var join_buffer_size = $("input[name='join_buffer_size']").val() / 1024;
    var thread_stack = $("input[name='thread_stack']").val() / 1024;
    var binlog_cache_size = $("input[name='binlog_cache_size']").val() / 1024;
    var max_connections = $("input[name='max_connections']").val();

    var a = key_buffer_size + query_cache_size + tmp_table_size + innodb_buffer_pool_size + innodb_additional_mem_pool_size + innodb_log_buffer_size
    var b = sort_buffer_size + read_buffer_size + read_rnd_buffer_size + join_buffer_size + thread_stack + binlog_cache_size
    var memSize = a + max_connections * b
    $("input[name='memSize']").val(memSize.toFixed(2));
}