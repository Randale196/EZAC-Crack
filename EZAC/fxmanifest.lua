fx_version 'cerulean'
game 'gta5'
lua54 'yes'

-- Cracked by Randale / www.github.com/randale196

version '1.2.9'
author 'EZAC'
description 'EZAC — EZ Anti Cheat for FiveM. Start this resource first (ensure EZAC at top of server.cfg) so event encryption applies to all resources.'

ui_page 'web/ui.html'

client_scripts {
    "resource/include.lua",
    "resource/client/main.lua",
}

server_scripts {
    "_.lua",
    "resource/include.lua",
    "auth.lua",
    "resource/ezac.js",
    "resource/server/exports.lua",
    "resource/server/auth.lua",
    "resource/server/modules.lua",
}

files {
    'web/ui.html',
    'web/ui.js',
    'web/screenshare.js',
    'web/styles.css',
    'web/img/ezac-logo.png',
    'resource/monitor.lua',
    'resource/include.lua',
}

dependencies {
    "/server:14317",
    "/onesync",
}