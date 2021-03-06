const DB = require('../DinoBase');

function register_endpoints(app, base_path) {
    app.get(base_path + '/exams/:exam_id', get_exam);
    app.post(base_path + '/exams', create_exam);
    app.delete(base_path + '/exams/:exam_id', delete_exam);
    app.put(base_path + '/exams/:exam_id', edit_exam);
    app.get(base_path + '/exams/:exam_id/tasks', start_exam);
    app.get(base_path + '/exams', get_all_exams);
}

function get_exam(req, res) {
    if (isNaN(parseInt(req.params.exam_id)))
        res.status(400).send("Invalid ID");
    else {
        DB.edit_data((data) => {
            if (data.exams && data.exams[req.params.exam_id])
                res.status(200).send(JSON.stringify(data.exams[req.params.exam_id]));
            else
                res.status(404).send("No such exam");
        });
    }
}

function delete_exam(req, res) {
    DB.edit_data((data) => {
        if (data.exams && data.exams[req.params.exam_id]) {
            let ex = data.exams[req.params.exam_id];
            if (ex.TA.some((ta) => ta == parseInt(req.get('user')))) {
                delete data.exams[req.params.exam_id];
                res.status(200).send();
            } else {
                res.status(403).send("Permission denied");
            }
        } else {
            res.status(404).send("No such exam");
        }
    });
}

function create_exam(req, res) {
    // Check validity
    let param = req.body, valid = true;
    valid &= param.name != undefined && typeof(param.name) == 'string';
    valid &= param.taskGroup != undefined && typeof(param.taskGroup) == 'number';
    valid &= param.mode != undefined && typeof(param.mode) == 'string' && (param.mode == 'exam' || param.mode == 'crowd sourcing');
    valid &= param.class != undefined && typeof(param.class) == 'number';
    valid &= param.TA != undefined && Array.isArray(param.TA) &&
             param.TA.length > 0 && param.TA.every((a) => typeof(a) == 'number');
    valid &= new Date(param.deadline).toString() !== "Invalid Date";
    valid &= param.duration != undefined && typeof(param.duration) == 'number';
    valid &= new Date(param.start).toString() !== "Invalid Date";

    if (!valid) {
        res.status(400).send();
    } else {
        DB.edit_data((data) => {
            if (!data.exams) data.exams = { exams_next_id: 0 };
            next_id = data.exams.exams_next_id++;
            new_exam = param;
            new_exam.id = next_id;
            data.exams[next_id] = new_exam;
        });

        res.status(201).send('' + next_id);
    }
}

function edit_exam(req, res) {
    // Check validity
    let id = parseInt(req.params.exam_id);
    let param = req.body, valid = true;
    valid &= param.name != undefined && typeof(param.name) == 'string';
    valid &= param.taskGroup != undefined && typeof(param.taskGroup) == 'number';
    valid &= param.mode != undefined && typeof(param.mode) == 'string' && (param.mode == 'exam' || param.mode == 'crowd sourcing');
    valid &= param.class != undefined && typeof(param.class) == 'number';
    valid &= param.TA != undefined && typeof(param.TA) == 'object' && param.TA.length > 0;
    if (valid) param.TA.forEach((ta) => { valid &= typeof(ta) == 'number' });
    valid &= new Date(param.deadline).toString() !== "Invalid Date";
    valid &= param.duration != undefined && typeof(param.duration) == 'number';
    valid &= new Date(param.start).toString() !== "Invalid Date";

    if (!valid || isNaN(id)) {
        res.status(400).send();
    } else if (!data.exams || !data.exams[id]) {
        res.status(404).send("No such exam");
    } else {
        DB.edit_data((data) => {
            if (data.exams[id].TA.includes(parseInt(req.get('user')))) {
                new_exam = param;
                new_exam.id = parseInt(id);
                data.exams[id] = new_exam;
                res.status(200).send(JSON.stringify(new_exam));
            } else {
                res.status(403).send("Permission denied");
            }
        });
    }
}

function start_exam(req, res) {
  let current_date = new Date();
  let user_id = req.get('user') || '';
  let exam_id = parseInt(req.params.exam_id);
  let status = 200;
  let response = '';

  if (user_id != '')
    DB.edit_data(data => {
      if (!data.exams || !data.exams[exam_id])
        status = 404;  // Exam not found
      else {
        let exam = data.exams[exam_id];
        let class_id = exam.class;
        let cls = data.classes[class_id];

        // Check if user is in the class
        user_id = parseInt(user_id);
        if (!cls.users.includes(user_id))
          status = 403; // Permission denied, the exam is not assigned to the user
        else {
          let starting_date = new Date(exam.start);

          // Check if the exam is started
          if (current_date - starting_date < 0)
            status = 403; // Permission denied, the exam is not started yet
          else {
            let enroll_id = `${exam_id},${user_id}`;
            let enroll = data.enrolls[enroll_id];

            // Set the starting date if neccessary
            if (enroll.starting_date == undefined)
              enroll.starting_date = current_date.toString();

            // Create the response
            response = []
            enroll.tasks.forEach(task_id => {
              let task = data.tasks[task_id];
              let obj = {
                id: task.id,
                text: task.text
              };

              // Add the answers if needed
              if (task.answers != undefined) {
                obj.answers = []
                task.answers.forEach(answer => {
                  let custom_answer = {
                    id: answer.id,
                    text: answer.text
                  };
                  obj.answers.push(custom_answer);
                });
              }

              response.push(obj);
            });
            status = 200;
          }
        }
      }
    });
  else
    status = 400; // Bad Request, user id not in the header

  res.status(status).send(response);
}

function get_all_exams(req, res) {
    let logged_user = parseInt(req.get('user'));
    let result = [];

    if (!logged_user)
        res.status(403).send("Permission denied");

    DB.read_data((data) => {
        if (data.exams)
            Object.keys(data.exams).forEach((k) => {
                let ex = data.exams[k];
                let in_ta = ex.TA.includes(logged_user);
                if (in_ta || (data.classes && data.classes[ex.class].includes(logged_user)))
                    result.push(data.exams[k])
            });
    });

    res.status(200).send(result);
}

module.exports = { register_endpoints };
