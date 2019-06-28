$(function(){
	// 言語
	var lang = 'ja';
	// 選択肢数
	var choice_num = 4;
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

	var goo_api_id = '4d44f0ac780c80a9574f4c62536bd60b0958cd3f5a3574dbbc57f316bcf6ddee';

	var display_hint_num = 0;

	Promise.resolve().then(getPageid).then(getPageContent).then(analyzeArticleText).then(getCategoryWithRelevance).then(createChoiceList).then(viewPage).catch(onError);

	/*
	出題対象となる記事をランダムで取得する
	*/
	function getPageid() {
		$('div#content').html('<div align="center"><img src="./loading.gif" width="200px"></div>');
		return new Promise(function(resolve, reject) {
			$.ajax({
				// wikipedia記事候補を20件取得
				url: 'https://'+lang+'.wikipedia.org/w/api.php?format=json&action=query&generator=random&grnlimit=20',
				data: {format: 'json'},
				dataType: 'jsonp'
			}).done(function (data){
				resolve(data);
			});
		});
	}

	/*
	出題対象となる記事を取得する
	*/
	function getPageContent(data) {
		return new Promise(function(resolve, reject) {
			var data_query_pages = [];
			for(var key in data.query.pages) {
				data_query_pages.push(data.query.pages[key])
			}
			var get_page_content = function() {
				var data_query_page = data_query_pages.shift();
				if(data_query_page.ns == 0) {
					var data_query_page_title = data_query_page.title;
					$.ajax({
						url: 'https://'+lang+'.wikipedia.org/w/api.php?action=parse&pageid='+data_query_page.pageid,
						data: {format: 'json'},
						dataType: 'jsonp'
					}).done(function (data){
						var is_ambiguity = false;
						for(var cate_key in data.parse.categories) {
							if(data.parse.categories[cate_key]["*"].indexOf('曖昧さ回避') >= 0) {
								is_ambiguity = true;
							}
						}
						// 曖昧さ回避のページは問題として使用しない
						if (is_ambiguity) {
							get_page_content();
						}
						else {
							answer_text = parenthesis_cut(data_query_page_title);
							choice_list.push(answer_text);
							resolve(data);
						}
					});
				}
				else {
					get_page_content();
				}
			};
			get_page_content();
		});
	}

	// 記事の文章を解析する
	function analyzeArticleText(data) {
		return new Promise(function(resolve, reject) {
			var text = '';
			for(var key in data.parse.text) {
				text = data.parse.text[key];
				break;
			}
			var article_text_array = format_tag_array(text, "p");
			var article_text = '';
			for(var i=0; i<article_text_array.length; i++) {
				if(article_text_array[i].indexOf("。") > 0 && article_text_array[i].indexOf("この記事には複数の") < 0) {
					article_text += text_middle_cut(article_text_array[i], '[', ']');
				}
			}
			article_sentence = article_text.split("。");
			$.ajax({
				url: 'https://labs.goo.ne.jp/api/morph',
				dataType: 'json',
				type: 'POST',
				data: {app_id: goo_api_id, sentence: article_sentence[0]},
			}).done(function(morph_data) {
				var question_text_array = [];
				for(var i=0; i<morph_data.word_list.length; i++) {
					for(var j=0; j<morph_data.word_list[i].length; j++) {
						if(morph_data.word_list[i][j][1] != '空白') {
							question_text_array.push({word: morph_data.word_list[i][j][0], part_of_speech: morph_data.word_list[i][j][1]});
						}
					}
				}
				CreateQuestionText(question_text_array);
				CreateHint();
				resolve(data);
			});
		});
	}
	
	// 問題文を作成する
	function CreateQuestionText(question_text_array) {
		var first_postpositional_particle = 0;
		var is_expected = false;
		for(var i=0; i<question_text_array.length; i++) {
			// 括弧の中にいる間は除外
			if(question_text_array[i].part_of_speech.indexOf('括弧') >= 0) {
				is_expected = !is_expected;
			}
			// 最初に出てくる連用助詞（～は）の位置を取得
			if(question_text_array[i].part_of_speech.indexOf('連用助詞') >= 0 && !is_expected) {
				first_postpositional_particle = i;
				break;
			}
		}
		
		var last_noun_num = 0;
		// 文章内で一番最後の名詞または括弧の位置を取得
		for(var i=0; i<question_text_array.length; i++) {
			if(question_text_array[i].part_of_speech.indexOf('名詞') >= 0 || question_text_array[i].part_of_speech.indexOf('括弧') >= 0) {
				last_noun_num = i;
			}
			if(question_text_array[i].part_of_speech.indexOf('名詞') >= 0) {
				questional_word = question_text_array[i].word;
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

	function CreateHint() {
		var tmp_article_sentence = article_sentence;
		article_sentence = [];

		for (var i=1; i<tmp_article_sentence.length; i++) {
			var is_use_hint = true;
			if (tmp_article_sentence[i].replace(/\r?\n/g, '').length > 0) {
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
				$('div#content').append('<div id="hint_' + i + '" class="card background-secondary padding" style="display: none;">Hint ' + (i+1) + ': ' + article_sentence[i] + '</div>');
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
		});
	}

	function onError(error) {
		console.log("error = " + error + "\r\n");
	}

	$('body').on('click', 'button#hint_button', function() {
		if (display_hint_num < article_sentence.length) {
			$('div#hint_' + display_hint_num).show();
			display_hint_num += 1;
			$('span#hint_of_num').html(display_hint_num);
			if (display_hint_num >= article_sentence.length) {
				$("span#hint_of_num").removeClass("secondary").addClass("danger");
			}
		}
	});

	$('body').on('click', 'button.answers', function(){
		$('button.answers').addClass("background-primary");
		$('button#answer_'+answer_of_choice_list).removeClass("background-primary").addClass($(this).attr('choice') == answer_of_choice_list ? "background-success" : "background-danger");
	});

});



function format_tag_array(text, tag) {
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