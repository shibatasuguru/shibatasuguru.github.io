$(function(){
	/* ----------
			設定
	---------- */
	// 言語
	var lang = 'ja';
	// 選択肢数
	var choice_num = 4;
	// GooAPI ID
	var goo_api_id = '4d44f0ac780c80a9574f4c62536bd60b0958cd3f5a3574dbbc57f316bcf6ddee';

		
	// 記事テキスト配列
	var article_sentence = [];
	// 問題文
	var question_text = '';
	// 正解
	var answer_text = '';
	// 選択肢
	var choice_list = [];
	// 正解選択肢
	var answer_of_choice_list = 0;
	// 問題となる記事と紐づくカテゴリ(関連度の高い順)
	var category_list = [];
	
	var questional_word = '';

	var display_hint_num = 0;

	var is_answered = false;

	function quiz() {
		article_sentence = [];
		question_text = '';
		answer_text = '';
		choice_list = [];
		answer_of_choice_list = 0;
		category_list = [];
		questional_word = '';
		display_hint_num = 0;
		is_answered = false;

		// ローディング開始
		$('div#content').html('<div align="center"><img src="./loading.gif" width="200px"></div>');

		Promise.resolve().then(getPageid).then(getPageContent).then(analyzeArticleText).then(getCategoryWithRelevance).then(createChoiceList).then(viewPage).catch(onError);
	}
	quiz();

	$('body').on('click', 'div#reload', function() {
		quiz();
	});

	/*
	出題対象となる記事をランダムで取得する
	*/
	function getPageid() {
		return new Promise(function(resolve, reject) {
			$.ajax({
				// wikipedia記事候補を20件取得
				url: 'https://'+lang+'.wikipedia.org/w/api.php?format=json&action=query&generator=random&grnlimit=20',
				data: {format: 'json'},
				dataType: 'jsonp'
			}).done(function (data) {
				var pages = [];
				for(var key in data.query.pages) {
					pages.push(data.query.pages[key])
				}
				resolve(pages);
			});
		});
	}

	/*
	出題対象となる記事を取得する
	*/
	function getPageContent(pages) {
		return new Promise(function(resolve, reject) {
			var getPageContent = function() {
				var page = pages.shift();
				// 記事かどうかの判定
				if(page.ns == 0) {
					var title = page.title;
					$.ajax({
						url: 'https://'+lang+'.wikipedia.org/w/api.php?action=parse&pageid='+page.pageid,
						data: {format: 'json'},
						dataType: 'jsonp'
					}).done(function (data) {
						var is_ambiguity = false;
						for(var cate_key in data.parse.categories) {
							if(data.parse.categories[cate_key]["*"].indexOf('曖昧さ回避') >= 0) {
								is_ambiguity = true;
							}
						}
						// 曖昧さ回避のページは問題として使用しない
						if (is_ambiguity) {
							getPageContent();
						}
						else {
							answer_text = parenthesis_cut(title);
							choice_list.push(answer_text);
							resolve(data);
						}
					});
				}
				else {
					getPageContent();
				}
			};
			getPageContent();
		});
	}

	// 記事の文章を解析する
	function analyzeArticleText(data) {
		return new Promise(function(resolve, reject) {
			var article_text_array = getArrayByTags(data.parse.text["*"], "p");
			var article_text = '';
			// 文章でない、単語レベルのものは除外する
			for(var i=0; i<article_text_array.length; i++) {
				if(article_text_array[i].indexOf("。") > 0) {
					article_text += text_middle_cut(article_text_array[i], '[', ']');
				}
			}
			// 改行をカットする
			article_text = article_text.replace(/\r?\n/g, '');

			$.ajax({
				url: 'https://labs.goo.ne.jp/api/morph',
				dataType: 'json',
				type: 'POST',
				data: {app_id: goo_api_id, sentence: article_text},
			}).done(function(morph_data) {
				var question_array = [];
				var question_text_array = [];
				var is_expected = false;
				for(var i=0; i<morph_data.word_list.length; i++) {
					for(var j=0; j<morph_data.word_list[i].length; j++) {
						if(morph_data.word_list[i][j][1] != '空白') {
							question_text_array.push({word: morph_data.word_list[i][j][0], part_of_speech: morph_data.word_list[i][j][1]});
							if(morph_data.word_list[i][j][1] == '句点' && !is_expected) {
								question_array.push(question_text_array);
								question_text_array = [];
							} else if (morph_data.word_list[i][j][1] == '括弧') {
								is_expected = !is_expected;
							}
						}
					}
				}
				CreateQuestionText(question_array[0]);
				CreateHint(question_array);
				resolve(data);
			});
		});
	}

	// 問題文を作成する
	function CreateQuestionText(question_text_array) {
		var first_postpositional_particle = 0;
		var is_expected = false;
		var last_noun_num = 0;
		var is_noun = true;
		for(var i=0; i<question_text_array.length; i++) {
			// 括弧の中にいる間は除外
			if(question_text_array[i].part_of_speech.indexOf('括弧') >= 0) {
				is_expected = !is_expected;
			}
			// 最初に出てくる連用助詞（～は）の位置を取得
			if(question_text_array[i].part_of_speech.indexOf('連用助詞') >= 0 && !is_expected && first_postpositional_particle == 0) {
				first_postpositional_particle = i;
			}
			// 文章内で一番最後の名詞または括弧の位置を取得
			if(question_text_array[i].part_of_speech.indexOf('名詞') >= 0 || question_text_array[i].part_of_speech.indexOf('括弧') >= 0) {
				last_noun_num = i;
			}
			// 文章内で一番最後の名称を取得
			if(question_text_array[i].part_of_speech.indexOf('名詞') >= 0 || question_text_array[i].part_of_speech.indexOf('格助詞') >= 0 || question_text_array[i].part_of_speech.indexOf('括弧') >= 0) {
				if (!is_noun) {
					questional_word = '';
				}
				is_noun = true;
				questional_word += question_text_array[i].word;
			} else {
				is_noun = false;
			}
		}
		
		var reading_point_cut_flg = true;
		for (var i=first_postpositional_particle+1; i<=last_noun_num; i++) {
			if (reading_point_cut_flg && question_text_array[i].part_of_speech.indexOf('読点') >= 0) {
			
			}
			else {
				reading_point_cut_flg = false;
				question_text += question_text_array[i].word;
			}
		}
		
		question_text = '次のうち、' + question_text + 'はどれか。';
	}

	function CreateHint(array) {
		var tmp_article_sentence = [];

		for (var i=0; i<array.length; i++) {
			var text = '';
			for (var j=0; j<array[i].length; j++) {
				text += array[i][j].word
			}
			tmp_article_sentence.push(text);
		}

		for (var i=1; i<tmp_article_sentence.length; i++) {
			var is_use_hint = true;
			if (tmp_article_sentence[i].length > 0) {
				for (var a=0; a<answer_text.length; a++) {
					if (tmp_article_sentence[i].indexOf(answer_text.substr(a,2)) >= 0) {
						is_use_hint = false;
						break;
					}
				}
			} else {
				is_use_hint = false;
			}

			if (is_use_hint) {
				article_sentence.push(tmp_article_sentence[i]);
			}
		}
	}

	/*
	出題対象となる記事と関連するカテゴリを取得し、類似度を取得する
	*/
	function getCategoryWithRelevance(data) {
		return new Promise(function(resolve, reject) {
			// 有効なカテゴリ一覧を取得
			var valid_cate_list = [];
			for(var cate_key in data.parse.categories) {
				if(data.parse.categories[cate_key]["hidden"] === undefined) {
					valid_cate_list.push(data.parse.categories[cate_key]["*"]);
				}
			}
			var category_array = new Array();
			// 回帰関数で、カテゴリ名と問題文の類似度を取得
			var getRelevance = function() {
				var cate = valid_cate_list.shift();
				$.ajax({
					url: 'https://labs.goo.ne.jp/api/textpair',
					type: 'POST',
					data: JSON.stringify({app_id: goo_api_id, text1: cate, text2: questional_word}),
				}).done(function(data) {
					category_array[cate] = data.score;
					if (valid_cate_list.length) {
						getRelevance();
					}
					else {
						// 類似度の高い順にソート
						for(var key in category_array) category_list.push(key);
						function Compare(a,b){
						    return category_array[b]-category_array[a];
						}
						category_list.sort(Compare);
						resolve(data);
					}
				});
			};
			getRelevance();
		});
	}

	// 選択肢を作成する
	function createChoiceList(data) {
		return new Promise(function(resolve, reject) {
			var getCategoryList = function() {
				var cate = category_list.shift();
				$.ajax({
					url: 'https://'+lang+'.wikipedia.org/w/api.php?action=query&cmtitle='+encodeURI('Category:'+cate)+'&cmlimit=10000&list=categorymembers&format=json',
					data: {format: 'json'},
					dataType: 'jsonp'
				}).done(function(category_data) {
					var candidate_choice_list = [];
					for(var i=0; i<category_data.query.categorymembers.length; i++) {
						if (category_data.query.categorymembers[i].ns == 0 && choice_list.indexOf(category_data.query.categorymembers[i].title) < 0 && category_data.query.categorymembers[i].title.indexOf("一覧") < 0) {
							candidate_choice_list.push(category_data.query.categorymembers[i].title);
						}
					}
					candidate_choice_list = shuffle_array(candidate_choice_list);
					while (choice_list.length < choice_num && candidate_choice_list.length > 0) {
						choice_list.push(parenthesis_cut(candidate_choice_list.shift()));
					}
					if (choice_list.length < choice_num) {
						getCategoryList();
					}
					else {
						resolve(data);
					}
				});
			};
			getCategoryList();
		});
	}

	// 画面を作成する
	function viewPage(data) {
		return new Promise(function(resolve, reject) {
			$('div#content').html('');
			$('div#content').append('<div class="card"><h5>'+question_text+'<br><button id="hint_button" style="display: '+(article_sentence.length > 0 ? 'block' : 'none')+';">Hints: <span id="hint_of_num" class="badge secondary">0</span> / <span class="badge">'+article_sentence.length+'</span></button></div>');
			for(var i=0; i<article_sentence.length; i++) {
				$('div#content').append('<button id="hint_' + i + '" class="card btn-secondary hint_card" style="display: none; width: 100%;">Hint ' + (i+1) + ': ' + article_sentence[i] + '</button>');
			}
			choice_list = shuffle_array(choice_list);

			for(var i=0; i<choice_list.length; i++) {
				if (choice_list[i] == answer_text) {
					answer_of_choice_list = i;
				}
			}

			$('div#content').append('<div id="answers" class="row child-borders"></div>');
			for(var i=0; i<choice_list.length; i++) {
				$('div#answers').append('<button id="answer_' + i + '" choice="' + i + '" class="answers sm-3 col">' + choice_list[i] + '</button>');
			}
			$('div#content').append('<div id="reload" align="center" style="display:none;"><img src="./reload.png" width="30px"></div>');
		});
	}

	function onError(error) {
		console.log("error = " + error + "\r\n");
	}
	
	function show_hint() {
		$('button.hint_card').hide();
		if (display_hint_num >= article_sentence.length) {
			display_hint_num = 0;
		}
		
		if (display_hint_num < article_sentence.length) {
			$('button#hint_' + display_hint_num).show();
			display_hint_num += 1;
			$('span#hint_of_num').html(display_hint_num);
		}
	}

	$('body').on('click', 'button#hint_button', function() {
		show_hint();
	});

	$('body').on('click', 'button.hint_card', function() {
		show_hint();
	});

	$('body').on('click', 'button.answers', function() {
		if (!is_answered) {
			var is_cleared = $(this).attr('choice') == answer_of_choice_list;
			$('button.answers').addClass("btn-primary");
			$('button#answer_'+answer_of_choice_list).removeClass("btn-primary").addClass(is_cleared ? "text-success btn-success" : "btn-danger");
			$('div#point').append(is_cleared ? '<span class="badge success">O</span>' : '<span class="badge danger">X</span>');
			$('div#reload').show();
			is_answered = true;
		}
	});

});



function getArrayByTags(text, tag) {
	var array = [];
	// DOMParserオブジェクト
	var parser = new DOMParser();
	// HTML文字列をパースし、documentオブジェクトを返す
	var doc = parser.parseFromString(text, "text/html");
	// documentオブジェクトから該当のタグのinnerTextを配列で返す
	var tag_array = doc.querySelectorAll(tag);
	for(var i=0; i<tag_array.length; i++) {
	  array.push(tag_array[i].innerText);
	}
	return array;
}

function shuffle_array(array) {
	for(var i = array.length - 1; i > 0; i--){
		var r = Math.floor(Math.random() * (i + 1));
		var tmp = array[i];
		array[i] = array[r];
		array[r] = tmp;
	}
	return array;
}

function parenthesis_cut(text) {
	return text_middle_cut(text, '(', ')').trim();
}

function text_middle_cut(text, start_char, end_char) {
	while(text.indexOf(start_char) >= 0 && text.indexOf(end_char) >= 0){
		text = text.slice(0, text.indexOf(start_char)) + text.slice(text.indexOf(end_char)+1);
	}
	return text;
}