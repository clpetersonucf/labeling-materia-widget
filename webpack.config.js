const fs = require('fs')
const path = require('path')
const widgetWebpack = require('materia-widget-development-kit/webpack-widget')
const copy = widgetWebpack.getDefaultCopyList()

const outputPath = path.join(process.cwd(), 'build')
const srcPath = path.join(__dirname, 'src') + path.sep

const customCopy = copy.concat([
	{
		from: path.join(__dirname, 'src', '_guides', 'assets'),
		to: path.join(outputPath, 'guides', 'assets'),
		toType: 'dir'
	}
])

const entries = {
	'creator': [
		path.join(srcPath, 'creator.html'),
		path.join(srcPath, 'creator.scss'),
		path.join(srcPath, 'spectrum.custom.js'),
		path.join(srcPath, 'creator.js'),
	],
	'player': [
		path.join(srcPath, 'player.html'),
		path.join(srcPath, 'player.scss'),
		path.join(srcPath, 'player.js'),
	],
	'scoreScreen': [
		path.join(srcPath, 'scorescreen.html'),
		path.join(srcPath, 'scorescreen.js'),
		path.join(srcPath, 'scorescreen.scss')
	]
}

const options = {
	copyList: customCopy,
	entries: entries
}

let buildConfig = widgetWebpack.getLegacyWidgetBuildConfig(options)
module.exports = buildConfig

// module.exports = widgetWebpack.getLegacyWidgetBuildConfig(options)
