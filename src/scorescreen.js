Namespace('Labeling').Scorescreen = (() => {
    let _qset = null;
    let _questions = null

    // the image asset
	let _img = null;

    let _svg = null;
	let _defs = null;

    // anchor tag opacity
	let _anchorOpacityValue = 1.0;

    // legacy support; older qsets are relative to window
	let _offsetX = 0;
	let _offsetY = 0;

    const start = (instance, qset, scoreTable, isPreview, qsetVersion) => {
        _qset = qset
        _questions = _qset.items;

        // deal with some legacy qset things
		if (_qset.options.version === 2) {
			_offsetX = -195;
			_offsetY = -45;
		}

        if ((_qset.options.opacity !== null) && (_qset.options.opacity !== undefined)) {
			_anchorOpacityValue = _qset.options.opacity;
		} else {
			_anchorOpacityValue = 1.0;
		}

        switch (_qset.options.backgroundTheme) {
			case 'themeGraphPaper':
				background = 'url(assets/labeling-graph-bg.png)';
				break;
			case 'themeCorkBoard':
				background = 'url(assets/labeling-cork-bg.jpg)';
				break;
			default:
				// convert to hex and zero pad the background, which is stored as an integer
				background = '#' + ('000000' + _qset.options.backgroundColor.toString(16)).substr(-6);
		}
    }

    const update = (qset, scoreTable) => {

    }

    const handleScoreDistribution = (distribution) => {

    }
})();
