const path = require('path');
const fs = require('fs');
const PLANTS = 0,
    STONES = 1,
    ENERGY = 2,
    ALL = [PLANTS, STONES, ENERGY],
    NICENAME = ['Sickle', 'Pi\u200bckaxe', 'Extractor'], // zero-width space character \u200b used to prevent censor of "Picka"
    NAME = ['sickle', 'pick', 'extractor']

module.exports = function autotool(mod) {
    const command = mod.command || mod.require.command

    let config
    try {
        config = require('./config.json')
    } catch (error) {
        config = {}
    }

    let collections = [],
        other = [],
        currentLocation,
        mountFlag = false,
        inventory,
        inventoryCache,
        currentTools = [],
        active

    command.add('autotool', (...args) => {
        args[0] = args[0].toLowerCase()
        switch (args[0]) {
            case 'pick':
            case 'sickle':
            case 'extractor':
                if (args[1] && ['disabled', 'disable', 'none', 'off'].includes(args[1].toLowerCase())) {
                    config[args[0]] = null
                    command.message(`Disabled auto-activating ${NICENAME[NAME.indexOf(args[0])]}`)
                    return
                }
                if (!inventoryCache) {
                    command.message('Please open your inventory before running this command')
                    return
                }
                let newTool = getItemIdChatLink(args.slice(1).join(' '))
                if (newTool) setTool(args[0], newTool)
                else command.message('No item link. Please link an item using ctrl+click')
                break
            case 'hide':
            case 'hideother':
            case 'unclutter':
            case 'showall':
            case 'show':
                config.hide = !config.hide
                command.message(`Quest and non-gathering collection nodes ${config.hide ? 'hidden' : 'spawned'}`)
                for (let coll in other) {
                    if (!config.hide) {
                        mod.send('S_SPAWN_COLLECTION', 4, other[coll])
                    } else {
                        mod.send('S_DESPAWN_COLLECTION', 2, { gameId: other[coll].gameId });
                    }
                }
                break
            case 'helper':
                config.helper = !config.helper
                command.message(`Gathering node finder helper beams ${config.helper ? 'en' : 'dis'}abled`)
                if (!config.helper) {
                    for (let coll in collections) {
                        if (collections[coll].helper) mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: collections[coll].gameId });
                    }
                }
                break
            case 'info':
                let template = '<font color="#FDD017"><ChatLinkAction param="1#####%id@%dbid@%name">&lt;CLICK ME&gt;</ChatLinkAction></chat>'
                let link = template.replace(/%name/, mod.game.me.name)
                command.message('Your currently configured items:')
                for (let type of ALL) {
                    let str = ''
                    if (config[NAME[type]] && !currentTools[type]) {
                        str += `<font color="#FF0000">Enabled in config but not found in inventory</font>`
                    } else if (!config[NAME[type]]) {
                        str += '<font color="#FF0000">Disabled in config</font>'
                    } else {
                        str += '<font color="#00FF00">Enabled - </font>'
                        str += link.replace(/%id/, currentTools[type].id).replace(/%dbid/, currentTools[type].dbid)
                    }
                    command.message(`${NICENAME[type]}: ${str}`)

                }
                command.message(`Gathering node finder helper beams: ${config.helper ? 'enabled' : 'disabled'}`)
                command.message(`Quest and non-gathering collection nodes: ${config.hide ? 'hidden' : 'spawned'}`)
                break
            default:
                command.message('Valid arguments: pick, sickle, extractor, helper, info')
                break
        }
        saveConfig()
    })

    function getItemIdChatLink(chatLink) {
        let regexId = /#(\d*)@/;
        let id = chatLink.match(regexId);
        if (id) return parseInt(id[1])
        else return null
    }

    function setTool(name, id) {
        let type = NAME.indexOf(name)
        let searchResult = inventoryCache.find(item => item.id == id)
        if (searchResult) {
            currentTools[type] = searchResult
            config[name] = currentTools[type].id
            active=null
            command.message(`${NICENAME[type]} configured - id: ${currentTools[type].id}`)
        } else {
            command.message(`Item id not found in inventory.`)
        }
    }

    mod.hook('S_SPAWN_COLLECTION', 4, event => {
        let type = Math.floor(event.id / 100)
        if (!ALL.includes(type)) {
            other[Number(event.gameId)] = event
            if (config.hide) return false
            return
        }
        collections[Number(event.gameId)] = event
        if (config.helper) {
            collections[Number(event.gameId)].helper = true
            event.gameId = event.gameId & BigInt(0xFFFF);
            event.loc.z -= 1000
            mod.toClient('S_SPAWN_DROPITEM', 6, {
                gameId: event.gameId,
                loc: event.loc,
                item: 98260,
                amount: 1,
                expiry: 30000,
                explode: false,
                masterwork: false,
                enchant: 0,
                source: BigInt(0),
                debug: false,
                owners: [{ id: 0 }]
            });
        }

    })
    mod.hook('S_DESPAWN_COLLECTION', 2, event => {
        if (other[event.gameId]) {
            delete other[event.gameId]
            return
        }
        let item = collections[Number(event.gameId)]
        if (!item) return
        if (item.helper) {
            mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: collections[event.gameId].gameId });
        }
        delete collections[event.gameId];
    })

    mod.hook('S_INVEN', 16, event => {
        inventory = inventory ? inventory.concat(event.items) : event.items

        if (!event.more) {
            for (let type of ALL) {
                currentTools[type] = inventory.find(item => config[NAME[type]] == item.id)
            }
            inventoryCache = inventory
            inventory = null
        }
    })

    mod.hook('C_PLAYER_LOCATION', 5, updateLocation);
    mod.hook('S_SPAWN_ME', 3, updateLocation)
    mod.hook('C_PLAYER_FLYING_LOCATION', 4, updateLocation)

    function updateLocation(event) {
        currentLocation = {
            loc: event.loc,
            dest: event.dest,
            w: event.w || currentLocation.w
        }
        calcTools()
    }

    function calcTools() {
        if (!currentLocation || Object.keys(collections).length == 0 || !inventoryCache) return
        if (mod.game.me.onPegasus || mod.game.me.inBattleground || !mod.game.me.alive) return
        if (mod.game.me.mounted) {
            if (mountFlag) return
            mountFlag = true
            mod.game.me.on('dismount', calcTools)
            return
        }
        if (mountFlag) {
            mountFlag = false
            mod.game.me.off('dismount', calcTools)
        }

        let nearest = Infinity,
            nearestGameId

        for (let coll in collections) {
            let dist = dist2Dsq(collections[coll].loc, currentLocation.loc)
            if (dist < nearest) {
                nearest = dist
                nearestGameId = coll
            }
        }
        if (nearestGameId) {
            let node = collections[nearestGameId]
            let type = Math.floor(node.id / 100)
            let tool = currentTools[type]
            if (!tool || type == active || !config[NAME[type]]) return
            active = type
            // console.log(`Activating ${NAME[type]}`)
            useItem(tool.id, tool.dbid)
        }
    }

    function dist2Dsq(loc1, loc2) {
        return Math.pow(loc2.x - loc1.x, 2) + Math.pow(loc2.y - loc1.y, 2);
    }

    function useItem(id, dbid) {
        mod.send('C_USE_ITEM', 3, {
            gameId: mod.game.me.gameId,
            id: id,
            dbid: dbid,
            target: 0,
            amount: 1,
            dest: { x: 0, y: 0, z: 0 },
            loc: currentLocation.dest || currentLocation.loc,
            w: currentLocation.w,
            unk1: 0,
            unk2: 0,
            unk3: 0,
            unk4: true
        })
    }

    mod.game.on('enter_loading_screen', reset)

    function reset() {
        currentLocation = null
        mountFlag = false
        mod.game.me.off('dismount', calcTools)
        active = undefined
    }

    function saveConfig() {
        fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, '\t'), err => { });
    }

    this.destructor = () => {
        for (let coll in collections) {
            if (collections[coll].helper) mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: collections[coll].gameId });
        }
        command.remove('autotool')
        if (mod.game) {
            mod.game.off('enter_loading_screen', reset)
            mod.game.me.off('dismount', calcTools)
        }
    }
}