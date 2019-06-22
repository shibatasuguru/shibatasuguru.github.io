$(function(){
	// 言語を設定
	var lang = 'ja';
	// 選択肢数を設定
	var choice_num = 4;
	// 選択肢
	var choice_list = [];

	function ajaxCategoryList(choice_list, cate_name, cate_name_cnt) {
		$.ajax({
			url: 'https://'+lang+'.wikipedia.org/w/api.php?action=query&cmtitle='+encodeURI('Category:'+cate_name[cate_name_cnt])+'&cmlimit=10000&list=categorymembers&format=json',
			data: {format: 'json'},
			dataType: 'jsonp'
		}).done(function(category_data) {
			var candidate_choice = [];
			for( var i=0; i<category_data.query.categorymembers.length; i++) {
				if (category_data.query.categorymembers[i].ns == 0 && choice_list.indexOf(category_data.query.categorymembers[i].title) < 0) {
					candidate_choice.push(category_data.query.categorymembers[i].title);
				}
			}
			candidate_choice = shuffle_array(candidate_choice);
			while (choice_list.length < choice_num && candidate_choice.length > 0) {
				choice_list.push(candidate_choice.shift());
			}
			if (choice_list.length < choice_num) {
				ajaxCategoryList(choice_list, cate_name, cate_name_cnt + 1);
			}
		});
	}

	// 問題の作成
	$.ajax({
		// 問題となるwikipedia記事候補を20件取得
		url: 'https://'+lang+'.wikipedia.org/w/api.php?format=json&action=query&generator=random&grnlimit=20',
		data: {format: 'json'},
		dataType: 'jsonp'
	}).done(function (data){
		// 20件中、テンプレートやカテゴリなどを除外し、1件目の記事を問題のテーマ記事とする
		var articleid = 0;
		for(var key in data.query.pages) {
			if(data.query.pages[key].ns == 0){
				articleid = key;
				choice_list.push(data.query.pages[key].title);
				break;
			}
		}
		if(articleid > 0) {
			$.ajax({
				url: 'https://'+lang+'.wikipedia.org/w/api.php?action=parse&pageid='+articleid,
				data: {format: 'json'},
				dataType: 'jsonp'
			}).done(function (article_data){
				// 選択肢の作成
				var valid_cate_array = [];
				for(var cate_key in article_data.parse.categories) {
					if(article_data.parse.categories[cate_key]["hidden"] === undefined) {
						valid_cate_array.push(article_data.parse.categories[cate_key]["*"]);
					}
				}
				ajaxCategoryList(choice_list, valid_cate_array, 0);

				var text = '';
				for(var key in article_data.parse.text) {
					text = article_data.parse.text[key];
					break;
				}
				p_tags = format_tag_array(text, "p");
			});
		}else{
			alert(1);
		}
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
	for( var i=0; i<tag_array.length; i++) {
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

function question_text() {

}

/*

TODO: 曖昧さ回避への対応
分音記号 // https://ja.wikipedia.org/w/api.php?action=parse&pageid=3542&format=xml

TODO: 問題文に一番適したカテゴリの選択。

*/