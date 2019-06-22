$(function(){
	// �����ݒ�
	var lang = 'ja';
	// �I��������ݒ�
	var choice_num = 4;
	// �I����
	var choice_list = [];

	function ajaxCategoryList(choice_list, cate_name, cate_name_cnt) {
	  $.ajax({
			url: 'https://'+lang+'.wikipedia.org/w/api.php?action=query&cmtitle='+encodeURI('Category:'+cate_name[cate_name_cnt])+'&cmlimit=10000&list=categorymembers&format=json',
			data: {format: 'json'},
      async: false,
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

	// ���̍쐬
	$.ajax({
		// ���ƂȂ�wikipedia�L������20���擾
		url: 'https://'+lang+'.wikipedia.org/w/api.php?format=json&action=query&generator=random&grnlimit=20',
		data: {format: 'json'},
		dataType: 'jsonp'
	}).done(function (data){
		// 20�����A�e���v���[�g��J�e�S���Ȃǂ����O���A1���ڂ̋L������̃e�[�}�L���Ƃ���
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
				// �I�����̍쐬
				var valid_cate_array = [];
				for(var cate_key in article_data.parse.categories) {
					if(article_data.parse.categories[cate_key]["hidden"] === undefined) {
						valid_cate_array.push(article_data.parse.categories[cate_key]["*"]);
					}
				}
				ajaxCategoryList(choice_list, valid_cate_array, 0);
				console.log(choice_list);

				var text = '';
				for(var key in article_data.parse.text) {
					text = article_data.parse.text[key];
					break;
				}
				p_tags = format_tag_array(text, "p");
				console.log(p_tags);
			});
		}else{
			alert(1);
		}
	});
});

function format_tag_array(text, tag) {
	var array = [];
	// DOMParser�I�u�W�F�N�g
	var parser = new DOMParser();
	// HTML��������p�[�X���Adocument�I�u�W�F�N�g��Ԃ�
	var doc = parser.parseFromString(text, "text/html");
	// document�I�u�W�F�N�g����Y���̃^�O��innerText��z��ŕԂ�
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

TODO: �B��������ւ̑Ή�
�����L�� // https://ja.wikipedia.org/w/api.php?action=parse&pageid=3542&format=xml

TODO: ��蕶�Ɉ�ԓK�����J�e�S���̑I���B

*/