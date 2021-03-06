const logger = require('../middleware/logger');
const fs =  require('fs');
const fsPromises =  require('fs').promises;
const path =  require('path');
const Joi = require('joi');

let data = [];
data.employees = require('../model/employees.json');
data.groups = require('../model/groups.json');
data.employeesPassword = require('../model/employeesPassword.json');

const employeeSchema = Joi.object({
    id: Joi.number().required(),
    firstname: Joi.string().min(1).max(30).required(),
    lastname: Joi.string().min(1).max(30).required(),
    email: Joi.string().email().required(),
    active: Joi.boolean().required(),
    groups: Joi.array().items(Joi.number()).optional()
});

async function updateData (dPath, content) {
    try {
        await fsPromises.writeFile(path.join(__dirname,'..','model',dPath), JSON.stringify(content, null, 4));
        if(dPath === 'employees.json')
            data.employees = require(`../model/${dPath}`);
        else if(dPath === 'groups.json')
            data.groups = require(`../model/${dPath}`);
        else
            data.employeesPassword = require(`../model/${dPath}`);
    } catch(error) {
        logger.log(`Caught Exception --> ${error}`, 'errorLog.txt');
    }
}

function checkGroups (groupArray) {
    if(groupArray){
        for(let element of groupArray) {
            if(!data.groups.find(g => g.id === element)) {
                return `${element} is not a valid group ID`;
            }
        }
    }
    return 'Okay';
}

const getAllEmployees = (request, response) => {
    let result;
    if(request.query.offset && request.query.limit) {
        let offset = request.query.offset;
        let limit = request.query.limit;
        let startIndex = (offset -1);
        let endIndex = parseInt(startIndex) + parseInt(limit);
        console.log(startIndex);
        console.log(endIndex);
        result = data.employees.slice(startIndex, endIndex);
    } else {
        result = data.employees;
    }
    logger.log(`Sending --> ${JSON.stringify(result)}`, 'reqLog.txt');
    response.status(200).json(result);
}

const createNewEmployee = (request, response) => {
    let newEmployee = request.body;
    logger.log(`Recieved body --> ${JSON.stringify(newEmployee)}`, 'reqLog.txt');
    newEmployee.id = data.employees.at(-1).id + 1;

    let validationResult = employeeSchema.validate(newEmployee);

    if(validationResult.error) {
        response.status(400).json({ "error": validationResult.error.details[0].message });
    } else {
        let isGroupValid = checkGroups(newEmployee.groups);
        if( isGroupValid != 'Okay') {
            response.status(400).json({ "error": `${isGroupValid}` });
        } else {
            logger.log(`Updated body --> ${JSON.stringify(newEmployee)}`, 'reqLog.txt');
            data.employees.push(newEmployee);
            if(newEmployee.groups) {
                for(let element of newEmployee.groups) {
                    if(data.groups.find(g => g.id === element).members) {
                        if(!data.groups.find(g => g.id === element).members.includes(newEmployee.id)) {
                            data.groups.find(g => g.id === element).members.push(newEmployee.id);
                        }
                    } else {
                        data.groups.find(g => g.id === element).members = [ newEmployee.id ];
                    }
                }
            }
            updateData('employees.json',data.employees);
            updateData('groups.json',data.groups);
            logger.log(`Sending --> ${JSON.stringify(newEmployee)}`, 'reqLog.txt');
            response.status(201).json(newEmployee);
        }
    }
}

const updateEmployee = (request, response) => {
    let updtEmployee = request.body;
    logger.log(`Recieved body --> ${JSON.stringify(updtEmployee)}`, 'reqLog.txt');
    updtEmployee.id = parseInt(request.params.id);

    let validationResult = employeeSchema.validate(updtEmployee);

    if(validationResult.error) {
        response.status(400).json({ "error": validationResult.error.details[0].message });
    } else {
        let isGroupValid = checkGroups(updtEmployee.groups);
        if( isGroupValid != 'Okay') {
            response.status(400).json({ "error": `${isGroupValid}` });
        } else {
            if(data.employees.find(e => e.id === updtEmployee.id)) {
                data.employees.find(e => e.id === updtEmployee.id).firstname = updtEmployee.firstname;
                data.employees.find(e => e.id === updtEmployee.id).lastname = updtEmployee.lastname;
                data.employees.find(e => e.id === updtEmployee.id).email = updtEmployee.email;
                data.employees.find(e => e.id === updtEmployee.id).active = updtEmployee.active;
                let oldGroups = data.employees.find(e => e.id === updtEmployee.id).groups;
                data.employees.find(e => e.id === updtEmployee.id).groups = updtEmployee.groups;
                logger.log(`Updated body --> ${JSON.stringify(updtEmployee)}`, 'reqLog.txt');
                if(updtEmployee.groups) {
                    let groupsToRemove = [];
                    let groupsToGrant = updtEmployee.groups;
                    if(oldGroups) {
                        groupsToRemove = oldGroups.filter( ( g ) => !updtEmployee.groups.includes( g ) );
                        groupsToGrant = groupsToGrant.concat(oldGroups);
                        groupsToGrant = groupsToGrant.filter( ( g ) => !groupsToRemove.includes( g ) );
                    }
                    groupsToGrant = Array.from(new Set(groupsToGrant)); 
                    groupsToRemove = Array.from(new Set(groupsToRemove));

                    logger.log(`Groups to grant --> ${groupsToGrant}`, 'reqLog.txt');
                    logger.log(`Groups to remove --> ${groupsToRemove}`, 'reqLog.txt');
                    //return;
                    for(let element of groupsToGrant) {
                        if(data.groups.find(g => g.id === element).members){
                            if(!data.groups.find(g => g.id === element).members.includes(updtEmployee.id))
                                data.groups.find(g => g.id === element).members.push(updtEmployee.id);
                        } else {
                            data.groups.find(g => g.id === element).members = [ updtEmployee.id ];
                        }
                    }
                    for(let element of groupsToRemove) {
                        data.groups.find(g => g.id === element).members.splice(data.groups.find(g => g.id === element).members.indexOf(updtEmployee.id),1);
                        if(data.groups.find(g => g.id === element).members.length == 0)
                            delete data.groups.find(g => g.id === element)['members'];
                    }
                } else {
                    for(let element of data.groups) {
                        if(element.members && element.members.indexOf(updtEmployee.id) != -1) {
                            element.members.splice(element.members.indexOf(updtEmployee.id),1);
                            if(element.members.length == 0)
                                delete element['members'];
                        }
                    }
                }
                updateData('employees.json',data.employees);
                updateData('groups.json',data.groups);
                logger.log(`Sending --> ${JSON.stringify(updtEmployee)}`, 'reqLog.txt');
                response.status(200).json(updtEmployee);
            } else {
                response.status(404).json({ "error": `Cannot find an existing employee with ID ${updtEmployee.id}` });
            }
        }
        
    }
}

const deleteEmployee = (request, response) => {
    if(data.employees.find(e => e.id === parseInt(request.params.id))) {
        logger.log(`Deleting user --> ${JSON.stringify(data.employees.find(e => e.id === parseInt(request.params.id)))}`, 'reqLog.txt');
        data.employees.splice(data.employees.indexOf(data.employees.find(e => e.id === parseInt(request.params.id)),1));
        for(let element of data.groups) {
            if(element.members && element.members.indexOf(parseInt(request.params.id)) != -1) {
                element.members.splice(element.members.indexOf(parseInt(request.params.id)),1);
                if(element.members.length == 0)
                    delete element['members'];
            }
        }
        if(data.employeesPassword.find(e => e.id === parseInt(request.params.id))) {
            data.employeesPassword.splice(data.employeesPassword.indexOf(data.employeesPassword.find(e => e.id === parseInt(request.params.id)),1));
            updateData('employeesPassword.json',data.employeesPassword);
        }
        updateData('employees.json',data.employees);
        updateData('groups.json',data.groups);
        logger.log(`Sending --> { "message": "Deleted user with ID ${request.params.id}" }`, 'reqLog.txt');
        response.status(200).json({ "message": `Deleted user with ID ${request.params.id}` });
    } else {
        response.status(404).json({ "error": `Cannot find an employee with ID ${request.params.id}` });
    }
}

const getEmployee = (request, response) => {
    let employee = data.employees.find(e => e.id === parseInt(request.params.id));
    if(!employee) {
        response.status(404).json({ "error": `Employee with Id ${request.params.id} Not Found` });
    } else {
        logger.log(`Sending --> ${JSON.stringify(employee)}`, 'reqLog.txt');
        response.status(200).json(employee);
    }
}

module.exports = { getAllEmployees, createNewEmployee, updateEmployee, deleteEmployee, getEmployee };