
local json = require "cjson"
local ngx_match = ngx.re.find

local __WAF = require "common"

-- print(json.encode(__C))
local C = __WAF:getInstance()

local config = require "waf_config"
local site_config = require "waf_site"
local config_domains = require "waf_domains"

-- C:D("config:"..C:to_json(config))

C:setConfData(config, site_config)
C:setDebug(true)


local get_html = require "html_get"
local post_html = require "html_post"
local other_html = require "html_other"
local user_agent_html = require "html_user_agent"
local cc_safe_js_html = require "html_safe_js"

local args_rules = require "rule_args"
local ip_white_rules = require "rule_ip_white"
local ip_black_rules = require "rule_ip_black"
local ipv6_black_rules = require "rule_ipv6_black"
local scan_black_rules = require "rule_scan_black"
local user_agent_rules = require "rule_user_agent"
local post_rules = require "rule_post"
local cookie_rules = require "rule_cookie"


local server_name = string.gsub(C:get_sn(config_domains),'_','.')

local function initParams()
    local data = {}
    data['server_name'] = server_name
    data['ip'] = C:get_real_ip(server_name)
    data['ipn'] = C:arrip(data['ip'])
    data['request_header'] = ngx.req.get_headers()
    data['uri'] = ngx.unescape_uri(ngx.var.uri)
    data['uri_request_args'] = ngx.req.get_uri_args()
    data['method'] = ngx.req.get_method()
    data['request_uri'] = ngx.var.request_uri
    data['status_code'] = ngx.status
    data['user_agent'] = data['request_header']['user-agent']
    data['cookie'] = ngx.var.http_cookie
    data['time'] = ngx.time()
    return data
end

local params = initParams()
C:setParams(params)

local cpu_percent = ngx.shared.waf_limit:get("cpu_usage")
if not cpu_percent then
    cpu_percent = 0 
end

local function get_return_state(rstate,rmsg)
    result = {}
    result['status'] = rstate
    result['msg'] = rmsg
    return result
end

local function get_waf_drop_ip()
    local data =  ngx.shared.waf_drop_ip:get_keys(0)
    return data
end

local function return_json(status,msg)
    ngx.header.content_type = "application/json"
    result = {}
    result['status'] = status
    result['msg'] = msg
    ngx.say(json.encode(data))
    ngx.exit(200)
end

local function is_chekc_table(data,strings)
    if type(data) ~= 'table' then return 1 end 
    if not data then return 1 end
    data = chekc_ip_timeout(data)
    for k,v in pairs(data)
    do
        if strings == v['ip'] then
            return 3
        end
    end
    return 2
end

local function save_ip_on(data)
    locak_file=read_file_body(cpath2 .. 'stop_ip.lock')
    if not locak_file then
        C:write_file(cpath2 .. 'stop_ip.lock','1')
    end
    name='stop_ip'
    local extime = 18000
    data = json.encode(data)
    ngx.shared.waf_limit:set(cpath2 .. name,data,extime)
    if not ngx.shared.waf_limit:get(cpath2 .. name .. '_lock') then
        ngx.shared.waf_limit:set(cpath2 .. name .. '_lock',1,0.5)
        C:write_file(cpath2 .. name .. '.json',data)
    end
end

local function remove_waf_drop_ip()
    if not uri_request_args['ip'] or not C:is_ipaddr(uri_request_args['ip']) then return get_return_state(true,'格式错误') end
    if ngx.shared.waf_limit:get(cpath2 .. 'stop_ip') then
        ret=ngx.shared.waf_limit:get(cpath2 .. 'stop_ip')
        ip_data=json.decode(ret)
        result = is_chekc_table(ip_data,uri_request_args['ip'])
        os.execute("sleep " .. 0.6)
        ret2 = ngx.shared.waf_limit:get(cpath2 .. 'stop_ip')
        ip_data2 = json.decode(ret2)
        if result == 3 then
            for k,v in pairs(ip_data2)
            do
                if uri_request_args['ip'] == v['ip'] then 
                    v['time'] = 0
                end
            end
        end
        save_ip_on(ip_data2)
    end
    ngx.shared.waf_drop_ip:delete(uri_request_args['ip'])
    return get_return_state(true,uri_request_args['ip'] .. '已解封')
end

local function clean_waf_drop_ip()
    if ngx.shared.waf_limit:get(cpath2 .. 'stop_ip') then
        ret2 = ngx.shared.waf_limit:get(cpath2 .. 'stop_ip')
        ip_data2 = json.decode(ret2)
        for k,v in pairs(ip_data2)
        do
            v['time'] = 0
        end
        save_ip_on(ip_data2)
        os.execute("sleep " .. 2)
    end
    local data = get_waf_drop_ip()
    for _,value in ipairs(data)
    do
        ngx.shared.waf_drop_ip:delete(value)
    end
    return get_return_state(true,'已解封所有封锁IP')
end

local function min_route()
    if ngx.var.remote_addr ~= '127.0.0.1' then return false end
    if uri == '/get_waf_drop_ip' then
        C:return_message(0,get_waf_drop_ip())
    elseif uri == '/remove_waf_drop_ip' then
        C:return_message(0,remove_waf_drop_ip())
    elseif uri == '/clean_waf_waf_waf_drop_ip' then
        C:return_message(0,clean_waf_drop_ip())
    end
end

local function waf_get_args()
    if not config['get']['open'] or not C:is_site_config('get') then return false end
    -- C:D("waf_get_args:"..C:to_json(args_rules)..":"..json.encode(params['uri_request_args']))
    if C:ngx_match_list(args_rules, params['uri_request_args']) then
        C:write_log('args','regular')
        C:return_html(config['get']['status'], get_html)
        return true
    end
    return false
end


local function waf_ip_white()
    for _,rule in ipairs(ip_white_rules)
    do
        if C:compare_ip(rule) then 
            return true 
        end
    end
    return false
end

local function waf_ip_black()
    -- ipv4 ip black
    for _,rule in ipairs(ip_black_rules)
    do
        if C:compare_ip(rule) then 
            ngx.exit(config['cc']['status'])
            return true 
        end
    end

    -- ipv6 ip black
    for _,rule in ipairs(ipv6_black_rules)
    do
        if rule == params['ip'] then 
            ngx.exit(config['cc']['status'])
            return true 
        end
    end
    return false
end


local function waf_user_agent()
    -- user_agent 过滤
    -- if not config['user-agent']['open'] or not C:is_site_config('user-agent') then return false end

    -- C:D("waf_user_agent;user_agent_rules:"..json.encode(user_agent_rules)..",ua:"..tostring(params['request_header']['user-agent']))
    if C:is_ngx_match_ua(user_agent_rules, params['request_header']['user-agent']) then
        -- C:D("waf_user_agent........... true")
        C:write_log('user_agent','regular')
        C:return_html(config['user-agent']['status'], user_agent_html)
        return true
    end

    -- C:D("waf_user_agent........... false")
    return false
end


local function waf_drop_ip()
    local ip = params['ip']
    local count = ngx.shared.waf_drop_ip:get(ip)
    if not count then return false end

    local retry = config['retry']['retry']
    -- C:D("waf_drop;count:"..tostring(count)..",retry:"..tostring(retry))
    -- C:D("waf_drop;count > retry:"..tostring(count > retry))
    if count >  retry then
        -- C:D("waf_drop_ip........... true")
        ngx.exit(config['cc']['status'])
        return true
    end
    -- C:D("waf_drop_ip........... false")
    return false
end

local function waf_cc()
    if not config['cc']['open'] or not C:is_site_config('cc') then return false end

    local ip = params['ip']

    -- 多次cc，才封禁。
    -- local ip_lock = ngx.shared.waf_drop_ip:get(ip)
    -- if ip_lock then
    --     if ip_lock > 0 then
    --         ngx.exit(config['cc']['status'])
    --         return true
    --     end
    -- end

    local request_uri = params['request_uri']

    local token = ngx.md5(ip .. '_' .. request_uri)
    local count = ngx.shared.waf_limit:get(token)

    local endtime = config['cc']['endtime']
    local waf_limit = config['cc']['limit']
    local cycle = config['cc']['cycle']

    if count then
        if count > waf_limit then 

            local safe_count, _ = ngx.shared.waf_drop_sum:get(ip)
            if not safe_count then
                ngx.shared.waf_drop_sum:set(ip, 1, 86400)
                safe_count = 1
            else
                ngx.shared.waf_drop_sum:incr(ip, 1)
            end
            local lock_time = (endtime * safe_count)
            if lock_time > 86400 then lock_time = 86400 end

            ngx.shared.waf_drop_ip:set(ip, 1, lock_time)
            local reason = cycle..'秒内累计超过'..waf_limit..'次请求,封锁' .. lock_time .. '秒'
            C:write_log('cc', reason)
            C:log(params, 'cc',reason)
            ngx.exit(config['cc']['status'])
            return true
        else
            ngx.shared.waf_limit:incr(token, 1)
        end
    else
        ngx.shared.waf_drop_sum:set(ip, 1, 86400)
        ngx.shared.waf_limit:set(token, 1, cycle)
    end
    return false
end

-- 是否符合开强制验证条件
local function is_open_waf_cc_increase()

    if config['safe_verify']['open'] then
        return true
    end

    if site_config[server_name]['safe_verify']['open'] then
        return true
    end

    if cpu_percent >= config['safe_verify']['cpu'] then
        return true
    end

    if cpu_percent >= site_config[server_name]['safe_verify']['cpu'] then
        return true
    end

    return false
end


--强制验证是否使用正常浏览器访问网站
local function waf_cc_increase()
    if not is_open_waf_cc_increase() then return false end

    local ip = params['ip']
    local uri = params['uri']
    local cache_token = ngx.md5(ip .. '_' .. server_name)

    --判断是否已经通过验证
    if ngx.shared.waf_limit:get(cache_token) then return false end

    local cache_rand_key = ip..':rand'
    local cache_rand = ngx.shared.waf_limit:get(cache_rand_key)
    if not cache_rand then 
        cache_rand = C:get_random(8)
        ngx.shared.waf_limit:set(cache_rand_key,cache_rand,30)
    end

    local make_token = "waf_unbind_"..cache_rand.."_"..cache_token
    local make_uri_str = "?token="..make_token
    local make_uri = "/"..make_uri_str

    if params['uri_request_args']['token'] then
        local args_token = params['uri_request_args']['token']
        if args_token == make_token then
            ngx.shared.waf_limit:set(cache_token, 1, config['safe_verify']['time'])
            local data = get_return_state(0, "ok")
            ngx.say(json.encode(data))
            ngx.exit(200)
        end
    end    

    local cc_html = ngx.re.gsub(cc_safe_js_html, "{uri}", make_uri_str)
    C:return_html(200, cc_html)
end


local function waf_url()
    if not config['get']['open'] or not C:is_site_config('get') then return false end
    --正则--
    if C:is_ngx_match(url_rules, params["uri"], 'url') then
        C:write_log('url','regular')
        C:return_html(config['get']['status'], get_html)
        return true
    end
    return false
end


local function waf_scan_black()
    -- 扫描软件禁止
    if not config['scan']['open'] or not C:is_site_config('scan') then return false end
    if not params["cookie"] then
        if C:ngx_match_string(scan_black_rules['cookie'], tostring(params["cookie"]),'scan') then
            C:write_log('scan','regular')
            ngx.exit(config['scan']['status'])
            return true
        end
    end

    if C:ngx_match_string(scan_black_rules['args'], params["request_uri"], 'scan') then
        C:write_log('scan','regular')
        ngx.exit(config['scan']['status'])
        return true
    end

    for key,value in pairs(params["request_header"])
    do
        if C:ngx_match_string(scan_black_rules['header'], key, 'scan') then
            C:write_log('scan','regular')
            ngx.exit(config['scan']['status'])
            return true
        end
    end
    return false
end

local function waf_post()
    if not config['post']['open'] or not C:is_site_config('post') then return false end   
    if params['method'] ~= "POST" then return false end
    local content_length = tonumber(params["request_header"]['content-length'])
    local max_len = 640 * 1020000
    if content_length > max_len then return false end
    if C:get_boundary() then return false end
    ngx.req.read_body()

    local request_args = params['uri_request_args']
    if not request_args then return false end

    for key, val in pairs(request_args) do
        if type(val) == "table" then
            if type(val[1]) == "boolean" then
                return false
            end
            data = table.concat(val, ", ")
        else
            data = val
        end
    end

    -- C:D("post:"..json.encode(data))
    if C:ngx_match_list(post_rules, data) then
        C:write_log('post','regular')
        C:return_html(config['post']['status'], post_html)
        return true
    end
    return false
end

local function  waf_post_data_check()
    if params['method'] == "POST" then

        C:D("post_data_check start")
        if C:return_post_data() then return false end
        ngx.req.read_body()

        local request_args = params['uri_request_args']
        if not request_args then return false end

        C:D("post_data_check:"..json.encode(params['request_header']))

        local av = nil
        if params['request_header'] then
            if not params['request_header']['content-type'] then return false end
            av = string.match(params['request_header']['content-type'], "=.+")

            C:D("post_data_check[av]:"..json.encode(av))
        end
        

        if not av then return false end
        ac = C:split(av,'=')

        if not ac then return false end 

        list_list = nil
        for i,v in ipairs(ac)
        do
             list_list = '--'..v
        end
        
        if not list_list then return false end 
        
        aaa = nil
        for k,v in pairs(request_args)
        do
            aaa = v
        end

        if not aaa then return false end 
        if tostring(aaa) == 'true' then return false end
        if type(aaa) ~= "string" then return false end
        data_len = C:split(aaa, list_list)

        if not data_len then return false end
        if arrlen(data_len) == 0 then return false end


        C:D("post_rules:"..json.encode(post_rules).."data_len:"..json.encode(data_len))

        if C:is_ngx_match_post(post_rules , data_len) then
            C:write_log('post','regular')
            C:return_html(config['post']['status'], post_html)
            return true
        end

    end
end


local function X_Forwarded()

    if params['method'] ~= "GET" then return false end
    if not config['get']['open'] or not C:is_site_config('get') then return false end 
    if not params["request_header"]['X-forwarded-For'] then return false end

    if C:ngx_match_list(args_rules, params["request_header"]['X-forwarded-For']) then
        C:write_log('args','regular')
        C:return_html(config['get']['status'], get_html)
        return true
    end
    return false
end


local function post_X_Forwarded()
    if not config['post']['open'] or not C:is_site_config('post') then return false end   
    if params['method'] ~= "POST" then return false end
    if not params["request_header"]['X-forwarded-For'] then return false end
    if C:is_ngx_match_list(post_rules, params["request_header"]['X-forwarded-For']) then
        C:write_log('post','regular')
        C:return_html(config['post']['status'], post_html)
        return true
    end
    return false
end

local function url_ext()
    if site_config[server_name] == nil then return false end
    for _,rule in ipairs(site_config[server_name]['disable_ext'])
    do
        if C:ngx_match_string("\\."..rule.."$", params['uri'],'url_ext') then
            if rule == "php" then
                C:write_log('php_path','regular')
            else
                C:write_log('path','regular')
            end
            C:return_html(config['other']['status'], other_html)
            return true
        end
    end
    return false
end

local function disable_upload_ext(ext)
    if not ext then return false end
    ext = string.lower(ext)
    if C:is_key(site_config[server_name]['disable_upload_ext'], ext) then
        C:write_log('upload_ext', '上传扩展名黑名单')
        C:return_html(config['other']['status'],other_html)
        return true
    end
end

local function data_in_php(data)
    if not data then
        return false
    else
        if C:is_ngx_match('php', data, 'post') then
            C:write_log('upload_ext','上传扩展名黑名单')
            C:return_html(config['other']['status'], other_html)
            return true
        else
            return false
        end
    end
end

local function post_data()
    if params["method"] ~= "POST" then return false end
    local content_length = tonumber(params["request_header"]['content-length'])
    if not content_length then return false end
    local max_len = 2560 * 1024000
    if content_length > max_len then return false end
    local boundary = C:get_boundary()
    if boundary then
        ngx.req.read_body()
        local data = ngx.req.get_body_data()
        if not data then return false end
        local tmp = ngx.re.match(data,[[filename=\"(.+)\.(.*)\"]])
        if not tmp then return false end
        if not tmp[2] then return false end
        local tmp2 = ngx.re.match(ngx.req.get_body_data(),[[Content-Type:[^\+]{45}]]) 
        disable_upload_ext(tmp[2])
        if tmp2 == nil then return false end 
        data_in_php(tmp2[0])
    end
    return false
end

local function waf_cookie()
    if not config['cookie']['open'] or not C:is_site_config('cookie') then return false end
    if not params["request_header"]['cookie'] then return false end
    if type(params["request_header"]['cookie']) ~= "string" then return false end
    request_cookie = string.lower(params["request_header"]['cookie'])
    if C:ngx_match_list(cookie_rules,request_cookie,'cookie') then
        C:write_log('cookie','regular')
        C:return_html(config['cookie']['status'],cookie_html)
        return true
    end
    return false
end


function waf()
    min_route()

    -- white ip
    if waf_ip_white() then return true end

    -- black ip
    if waf_ip_black() then return true end

    -- 封禁ip返回
    if waf_drop_ip() then return true end

    -- ua check
    if waf_user_agent() then return true end
    if waf_url() then return true end

    -- cc setting
    if waf_cc_increase() then return true end
    if waf_cc() then return true end

    -- cookie检查
    if waf_cookie() then return true end
    
    -- args参数拦截
    if waf_get_args() then return true end

    -- 扫描软件禁止
    if waf_scan_black() then return true end

    if waf_post() then return true end
    -- if waf_post_data_check() then return true end
    
    if site_config[server_name] and site_config[server_name]['open'] then
        if X_Forwarded() then return true end
        if post_X_Forwarded() then return true end
        if url_ext() then return true end
        if post_data() then return true end 
    end
end

waf()